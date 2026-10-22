const express = require("express");

const upload = require("../middleware/uploadMiddleware");

const {
    uploadGemstoneImage,
    getGemstoneImages,
    updateGemstoneImage,
    deleteGemstoneImage
} = require("../controllers/gemstoneImageController");

const router = express.Router();

// Upload a single image before saving its gemstone image record.
router.post(
    "/upload",
    upload.single("image"),
    uploadGemstoneImage
);

// Return all image records for the specified gemstone.
router.get(
    "/:gemstone_id",
    getGemstoneImages
);

// Update the type or primary-image status of an existing image.
router.put(
    "/:id",
    updateGemstoneImage
);

// Delete an image record and clean up its file when it is no longer referenced.
router.delete(
    "/:id",
    deleteGemstoneImage
);

// Export the configured gemstone image routes.
module.exports = router;