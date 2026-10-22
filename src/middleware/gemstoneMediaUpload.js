const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");

// Resolve and create the directory used to store gemstone media uploads.
const uploadDirectory = path.resolve(__dirname, "../../uploads/gemstones");
fs.mkdirSync(uploadDirectory, { recursive: true });

// Configure disk storage with timestamp-based names and random suffixes.
const storage = multer.diskStorage({
  // Save accepted media files in the gemstone upload directory.
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  // Preserve the file extension while generating a collision-resistant name.
  filename: (_req, file, callback) => {
    callback(
      null,
      `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${path.extname(file.originalname).toLowerCase()}`
    );
  },
});

// Define the accepted MIME types for gemstone images and videos.
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const upload = multer({
  storage,
  // Limit each file to 25 MB and each request to seven files.
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 7,
  },
  fileFilter: (_req, file, callback) => {
    // Verify that the file extension matches an accepted image or video MIME type.
    const extension = path.extname(file.originalname).toLowerCase();
    const isImage =
      imageTypes.has(file.mimetype) &&
      [".jpg", ".jpeg", ".png", ".webp"].includes(extension);
    const isVideo =
      videoTypes.has(file.mimetype) &&
      [".mp4", ".webm", ".mov"].includes(extension);

    // Accept videos only in the videoClip field and images in image fields.
    if (
      (file.fieldname === "videoClip" && isVideo) ||
      (file.fieldname !== "videoClip" && isImage)
    ) {
      return callback(null, true);
    }

    return callback(
      new Error(
        file.fieldname === "videoClip"
          ? "Video clip must be an MP4, WEBM, or MOV file"
          : "Gemstone photos must be JPG, JPEG, PNG, or WEBP files"
      )
    );
  },
}).fields([
  { name: "mainImage", maxCount: 1 },
  { name: "backViewImage", maxCount: 1 },
  { name: "rightViewImage", maxCount: 1 },
  { name: "leftViewImage", maxCount: 1 },
  { name: "additional_view_1", maxCount: 1 },
  { name: "additional_view_2", maxCount: 1 },
  { name: "videoClip", maxCount: 1 },
]);

// Run Multer and return consistent HTTP errors for rejected uploads.
module.exports = (req, res, next) => {
  upload(req, res, (error) => {
    // Continue to the route when all uploads pass validation.
    if (!error) {
      return next();
    }

    // Use 413 for oversized files and 400 for other upload errors.
    const status =
      error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? 413
        : 400;

    return res.status(status).json({
      success: false,
      message: error.message,
    });
  });
};
