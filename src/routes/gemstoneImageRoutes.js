const express = require("express");

const upload = require("../middleware/uploadMiddleware");

const {
    uploadGemstoneImage,
    getGemstoneImages,
    updateGemstoneImage,
    deleteGemstoneImage
} = require("../controllers/gemstoneImageController");

const router = express.Router();

router.post(
    "/upload",
    upload.single("image"),
    uploadGemstoneImage
);

router.get(
    "/:gemstone_id",
    getGemstoneImages
);

router.put(
    "/:id",
    updateGemstoneImage
);

router.delete(
    "/:id",
    deleteGemstoneImage
);

module.exports = router;