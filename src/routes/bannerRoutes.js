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

const router = express.Router();

// Create Banner
router.post("/", createBanner);

// Upload Banner Image / Video
router.post(
  "/upload",
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
router.put("/:id", updateBanner);

// Delete Banner
router.delete("/:id", deleteBanner);

module.exports = router;