const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Resolve and create the directory used to store jewellery images.
const uploadDirectory = path.resolve(__dirname, "../../uploads/jewellery");
fs.mkdirSync(uploadDirectory, { recursive: true });

// Configure Multer to save uploads with unique names and their original extensions.
const storage = multer.diskStorage({
  // Save each accepted image in the jewellery upload directory.
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  // Prefix the lowercase original extension with a timestamp and random value.
  filename: (_req, file, callback) => {
    callback(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`
    );
  },
});

// List the accepted image MIME types.
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

// Export the upload middleware with a 5 MB limit and image validation.
module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    // Require both an accepted MIME type and matching image extension.
    const extension = path.extname(file.originalname).toLowerCase();
    if (
      imageTypes.has(file.mimetype) &&
      [".jpg", ".jpeg", ".png", ".webp"].includes(extension)
    ) {
      return callback(null, true);
    }

    return callback(new Error("Only JPG, JPEG, PNG and WEBP images are allowed"));
  },
});
