const express = require("express");
const router = express.Router();
const jewelleryController = require("../controllers/jewelleryController");
const uploadJewelleryImage = require("../middleware/jewelleryUpload");
const {
  verifyToken,
  requireAdmin,
  requireSuperAdmin
} = require("../middleware/authMiddleware");

// Public routes (frontend can read jewellery data)
router.get("/pending-approvals", verifyToken, requireSuperAdmin, jewelleryController.getPendingJewellery);
router.get("/", jewelleryController.getAllJewellery);
router.get("/low-stock", jewelleryController.getLowStockJewellery);
router.get("/:id", jewelleryController.getJewelleryById);

// Admin & Superadmin management routes
router.post("/", verifyToken, requireAdmin, uploadJewelleryImage.single("image"), jewelleryController.createJewellery);
router.put("/:id", verifyToken, requireAdmin, uploadJewelleryImage.single("image"), jewelleryController.updateJewellery);
router.patch("/:id/status", verifyToken, requireSuperAdmin, jewelleryController.updateJewelleryStatus);
router.put("/:id/status", verifyToken, requireSuperAdmin, jewelleryController.updateJewelleryStatus);
router.delete("/:id", verifyToken, requireAdmin, jewelleryController.deleteJewellery);

module.exports = router;
