const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");

const uploadDirectory = path.resolve(__dirname, "../../uploads/certificates");

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        fs.mkdirSync(uploadDirectory, { recursive: true });
        callback(null, uploadDirectory);
    },
    filename: (req, file, callback) => {
        callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    }
});

const allowedMimeTypes = new Map([
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".png", "image/png"],
    [".pdf", "application/pdf"]
]);

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        if (allowedMimeTypes.get(extension) === file.mimetype) {
            callback(null, true);
            return;
        }

        callback(new Error("Certificate files must be JPG, PNG or PDF."));
    }
});

const uploadCertificate = (req, res, next) => {
    upload.single("certificate")(req, res, (error) => {
        if (!error) {
            next();
            return;
        }

        const status = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
            ? 413
            : 400;
        res.status(status).json({
            success: false,
            message: error instanceof multer.MulterError
                ? error.message
                : error.message || "Certificate upload failed."
        });
    });
};

module.exports = uploadCertificate;
