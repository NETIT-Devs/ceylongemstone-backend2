const express = require("express");
const router = express.Router();
const gemstoneController = require("../controllers/gemstoneController");
const gemstoneMediaUpload = require("../middleware/gemstoneMediaUpload");
const {
  verifyToken,
  requireAdmin,
  requireSuperAdmin
} = require("../middleware/authMiddleware");

// Allow super administrators to review pending gemstone submissions.
router.get("/pending-approvals", verifyToken, requireSuperAdmin, gemstoneController.getPendingGemstones);

// Expose gemstone listings, low-stock items, and individual records.
router.get("/", gemstoneController.getAllGemstones);
router.get("/low-stock", gemstoneController.getLowStockGemstones);
router.get("/:id", gemstoneController.getGemstoneById);

// Require an administrator and process uploaded media when creating a gemstone.
router.post("/", verifyToken, requireAdmin, gemstoneMediaUpload, gemstoneController.createGemstone);

// Allow only super administrators to approve or reject gemstone submissions.
router.put("/:id/approval", verifyToken, requireSuperAdmin, gemstoneController.updateGemstoneApproval);

// Require an administrator and process uploaded media when updating a gemstone.
router.put("/:id", verifyToken, requireAdmin, gemstoneMediaUpload, gemstoneController.updateGemstone);

// Require an administrator to delete a gemstone.
router.delete("/:id", verifyToken, requireAdmin, gemstoneController.deleteGemstone);

// Export the configured gemstone routes.
module.exports = router;