const express = require("express");

const {
  createBanner,
  uploadBannerMedia,
  getBanners,
  getActiveBanners,
  getBannerById,
  updateBanner,
  deleteBanner
} = require("../controllers/bannerController");

const uploadBanner = require("../middleware/bannerUpload");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Create Banner
router.post("/", verifyToken, requireAdmin, createBanner);

// Upload Banner Image / Video
router.post(
  "/upload",
  verifyToken,
  requireAdmin,
  uploadBanner.single("media"),
  uploadBannerMedia
);

// Get All Banners
router.get("/", getBanners);

// Get Active Banners
router.get("/active", getActiveBanners);

// Get Single Banner
router.get("/:id", getBannerById);

// Update Banner
router.put("/:id", verifyToken, requireAdmin, updateBanner);

// Delete Banner
router.delete("/:id", verifyToken, requireAdmin, deleteBanner);

module.exports = router;