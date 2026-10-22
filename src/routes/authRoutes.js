const express = require("express");
const session = require("express-session");
const passport = require("../config/passport");
const { googleAuthCallback } = require("../controllers/googleAuthController");
const {
  register,
  forgotPassword,
  resetPassword,
  createAdminUser,
  getAdminUsers,
  login,
  getProfile,
  deleteAdminUser,
  updateAdminUserStatus
} = require("../controllers/authController");
const {
  verifyToken,
  requireAdmin,
  requireSuperAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();

// Ensure all required environment settings exist before starting Google sign-in.
const ensureGoogleOAuthConfigured = (req, res, next) => {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_CALLBACK_URL ||
    !process.env.SESSION_SECRET
  ) {
    return res.status(503).json({
      success: false,
      message: "Google sign-in is missing required server configuration"
    });
  }

  next();
};

// Cache the short-lived OAuth session middleware after its first use.
let googleOAuthSessionMiddleware;
const googleOAuthSession = (req, res, next) => {
  // Configure a temporary, HTTP-only session for the OAuth redirect flow.
  if (!googleOAuthSessionMiddleware) {
    googleOAuthSessionMiddleware = session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 10 * 60 * 1000
      }
    });
  }

  googleOAuthSessionMiddleware(req, res, next);
};

// Public account registration and password recovery endpoints.
router.post("/register", register);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Restrict administrator management routes according to the caller's role.
router.get("/admin-users", verifyToken, requireSuperAdmin, getAdminUsers);
router.post("/admin-users", verifyToken, requireAdmin, createAdminUser);
router.post("/login", login);

// Begin Google OAuth after checking configuration and initializing the session.
router.get(
  "/google",
  ensureGoogleOAuthConfigured,
  googleOAuthSession,
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false
  })
);

// Verify Google's callback and issue the application's authentication response.
router.get(
  "/google/callback",
  ensureGoogleOAuthConfigured,
  googleOAuthSession,
  (req, res, next) => {
    // Authenticate without creating a persistent Passport login session.
    passport.authenticate("google", { session: false }, (error, user, info) => {
      // Return a server error when the OAuth strategy itself fails.
      if (error) {
        console.error("Google OAuth Error:", error);
        return res.status(500).json({
          success: false,
          message: "Google sign-in failed"
        });
      }

      // Reject callbacks that did not resolve to a verified user.
      if (!user) {
        return res.status(401).json({
          success: false,
          message: info?.message || "Google sign-in could not verify your account"
        });
      }

      // Pass the verified user to the token-issuing callback handler.
      req.user = user;
      return googleAuthCallback(req, res);
    })(req, res, next);
  }
);

// Expose the signed-in user's profile through token-protected aliases.
router.get("/profile", verifyToken, getProfile);
router.get("/me", verifyToken, getProfile);

// Require an authenticated administrator to manage user accounts.
router.delete("/users/:id", verifyToken, requireAdmin, deleteAdminUser);
router.put("/users/:id/status", verifyToken, requireAdmin, updateAdminUserStatus);

// Export the configured authentication routes.
module.exports = router;