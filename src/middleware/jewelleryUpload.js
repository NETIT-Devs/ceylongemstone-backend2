const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDirectory = path.resolve(__dirname, "../../uploads/jewellery");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => {
    callback(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`
    );
  },
});

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
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
