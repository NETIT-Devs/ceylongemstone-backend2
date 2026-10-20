require("dotenv").config();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("./db");

if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL
) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        state: true
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.trim().toLowerCase();
          if (!email || profile._json?.email_verified !== true) {
            return done(null, false, {
              message: "A verified Google email address is required"
            });
          }

          let [users] = await db.query(
            `SELECT id, name, email, role, approval_status, phone, address, status
             FROM users
             WHERE email = ?
             LIMIT 1`,
            [email]
          );

          if (users.length === 0) {
            const name = profile.displayName?.trim() || email.split("@")[0];
            const randomPassword = crypto.randomBytes(32).toString("hex");
            const passwordHash = await bcrypt.hash(randomPassword, 10);
            let insertResult;

            try {
              [insertResult] = await db.query(
                `INSERT INTO users
                  (name, email, password, role, approval_status, phone, address, status)
                 VALUES (?, ?, ?, 'CUSTOMER', 'APPROVED', NULL, NULL, 1)`,
                [name, email, passwordHash]
              );
            } catch (error) {
              if (error.code !== "ER_DUP_ENTRY") {
                throw error;
              }
            }

            if (insertResult) {
              users = [{
                id: insertResult.insertId,
                name,
                email,
                role: "CUSTOMER",
                approval_status: "APPROVED",
                phone: null,
                address: null,
                status: 1
              }];
            } else {
              [users] = await db.query(
                `SELECT id, name, email, role, approval_status, phone, address, status
                 FROM users
                 WHERE email = ?
                 LIMIT 1`,
                [email]
              );
            }
          }

          const user = users[0];
          if (!user) {
            return done(new Error("Google account could not be loaded after sign-in"));
          }

          if (Number(user.status) !== 1) {
            return done(null, false, {
              message: "This account is disabled. Please contact support."
            });
          }

          if (
            String(user.role).toUpperCase() === "ADMIN" &&
            String(user.approval_status).toUpperCase() !== "APPROVED"
          ) {
            return done(null, false, {
              message: "This admin account is awaiting approval."
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
}

module.exports = passport;
