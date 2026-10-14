const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");

const uploadDirectory = path.resolve(__dirname, "../../uploads/gemstones");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => {
    callback(
      null,
      `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${path.extname(file.originalname).toLowerCase()}`
    );
  },
});

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const isImage =
      imageTypes.has(file.mimetype) &&
      [".jpg", ".jpeg", ".png", ".webp"].includes(extension);
    const isVideo =
      videoTypes.has(file.mimetype) &&
      [".mp4", ".webm", ".mov"].includes(extension);

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
  { name: "videoClip", maxCount: 1 },
]);

module.exports = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) {
      return next();
    }

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
