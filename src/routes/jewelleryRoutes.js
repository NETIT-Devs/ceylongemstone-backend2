const express = require("express");
const router = express.Router();
const jewelleryController = require("../controllers/jewelleryController");
const jwt = require("jsonwebtoken");

const optionalAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "gemstone_project_secret_key_2026"
      );
      req.user = decoded;
    }
  } catch {
    // Continue even if token is invalid or expired
  }
  next();
};

// Public routes (frontend can read jewellery data)
router.get("/", jewelleryController.getAllJewellery);
router.get("/low-stock", jewelleryController.getLowStockJewellery);
router.get("/:id", jewelleryController.getJewelleryById);

// Admin & Superadmin management routes
router.post("/", optionalAdmin, jewelleryController.createJewellery);
router.put("/:id", optionalAdmin, jewelleryController.updateJewellery);
router.patch("/:id/status", optionalAdmin, jewelleryController.updateJewelleryStatus);
router.put("/:id/status", optionalAdmin, jewelleryController.updateJewelleryStatus);
router.delete("/:id", optionalAdmin, jewelleryController.deleteJewellery);

module.exports = router;

