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

let googleOAuthSessionMiddleware;
const googleOAuthSession = (req, res, next) => {
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

router.post("/register", register);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/admin-users", verifyToken, requireSuperAdmin, getAdminUsers);
router.post("/admin-users", verifyToken, requireAdmin, createAdminUser);
router.post("/login", login);
router.get(
  "/google",
  ensureGoogleOAuthConfigured,
  googleOAuthSession,
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false
  })
);
router.get(
  "/google/callback",
  ensureGoogleOAuthConfigured,
  googleOAuthSession,
  (req, res, next) => {
    passport.authenticate("google", { session: false }, (error, user, info) => {
      if (error) {
        console.error("Google OAuth Error:", error);
        return res.status(500).json({
          success: false,
          message: "Google sign-in failed"
        });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: info?.message || "Google sign-in could not verify your account"
        });
      }

      req.user = user;
      return googleAuthCallback(req, res);
    })(req, res, next);
  }
);
router.get("/profile", verifyToken, getProfile);
router.get("/me", verifyToken, getProfile);
router.delete("/users/:id", verifyToken, requireAdmin, deleteAdminUser);
router.put("/users/:id/status", verifyToken, requireAdmin, updateAdminUserStatus);

module.exports = router;