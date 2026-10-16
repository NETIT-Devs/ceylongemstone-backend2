const express = require("express");
const router = express.Router();
const gemstoneController = require("../controllers/gemstoneController");
const gemstoneMediaUpload = require("../middleware/gemstoneMediaUpload");
const {
  verifyToken,
  requireAdmin,
  requireSuperAdmin
} = require("../middleware/authMiddleware");

router.get("/pending-approvals", verifyToken, requireSuperAdmin, gemstoneController.getPendingGemstones);
router.get("/", gemstoneController.getAllGemstones);
router.get("/low-stock", gemstoneController.getLowStockGemstones);
router.get("/:id", gemstoneController.getGemstoneById);
router.post("/", verifyToken, requireAdmin, gemstoneMediaUpload, gemstoneController.createGemstone);
router.put("/:id/approval", verifyToken, requireSuperAdmin, gemstoneController.updateGemstoneApproval);
router.put("/:id", verifyToken, requireAdmin, gemstoneMediaUpload, gemstoneController.updateGemstone);
router.delete("/:id", verifyToken, requireAdmin, gemstoneController.deleteGemstone);

module.exports = router; 