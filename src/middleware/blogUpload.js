const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Resolve and create the directory where blog images are stored.
const uploadDirectory = path.resolve(__dirname, "../../uploads/blogs");
fs.mkdirSync(uploadDirectory, { recursive: true });

// Configure Multer to save uploads with unique names and their original extensions.
const storage = multer.diskStorage({
  // Save every accepted upload in the blog image directory.
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  // Prefix the lowercase original extension with a timestamp and random value.
  filename: (_req, file, callback) => {
    callback(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`
    );
  },
});

// Allow only the supported image MIME types and file extensions.
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

// Export the upload middleware with a 5 MB limit and image type validation.
module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    // Check both MIME type and extension before accepting the uploaded file.
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
