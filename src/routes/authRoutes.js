const express = require("express");
const {
  register,
  createAdminUser,
  login,
  getProfile,
  deleteAdminUser,
  updateAdminUserStatus
} = require("../controllers/authController");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/admin-users", verifyToken, requireAdmin, createAdminUser);
router.post("/login", login);
router.get("/profile", verifyToken, getProfile);
router.get("/me", verifyToken, getProfile);
router.delete("/users/:id", verifyToken, requireAdmin, deleteAdminUser);
router.put("/users/:id/status", verifyToken, requireAdmin, updateAdminUserStatus);

module.exports = router;