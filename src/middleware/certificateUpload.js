const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");

// Resolve the directory used to store uploaded certificate files.
const uploadDirectory = path.resolve(__dirname, "../../uploads/certificates");

// Configure Multer to save each upload with a unique name and original extension.
const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        // Create the upload directory if it does not already exist.
        fs.mkdirSync(uploadDirectory, { recursive: true });
        callback(null, uploadDirectory);
    },
    filename: (req, file, callback) => {
        // Use a UUID to avoid filename collisions while preserving the extension.
        callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    }
});

// Match allowed file extensions to their expected MIME types.
const allowedMimeTypes = new Map([
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".png", "image/png"],
    [".pdf", "application/pdf"]
]);

// Set the upload size limit and reject files with unsupported type/extension pairs.
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        // Validate both the extension and MIME type before accepting a file.
        const extension = path.extname(file.originalname).toLowerCase();
        if (allowedMimeTypes.get(extension) === file.mimetype) {
            callback(null, true);
            return;
        }

        callback(new Error("Certificate files must be JPG, PNG or PDF."));
    }
});

// Handle the accepted certificate fields and convert upload errors to HTTP responses.
const uploadCertificate = (req, res, next) => {
    // Allow one file for each supported certificate form field.
    upload.fields([
        { name: "certificate", maxCount: 1 },
        { name: "certificate_url", maxCount: 1 }
    ])(req, res, (error) => {
        // Continue to the route when Multer completes without an error.
        if (!error) {
            next();
            return;
        }

        // Use 413 for oversized files and 400 for other upload validation errors.
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

// Export the middleware for certificate upload routes.
module.exports = uploadCertificate;
