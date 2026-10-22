const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Resolve and create the directory used to store gemstone image uploads.
const uploadDirectory = path.resolve(__dirname, "../../uploads/gemstones");
fs.mkdirSync(uploadDirectory, { recursive: true });

// Configure Multer to store files on disk with unique filenames.
const storage = multer.diskStorage({
    // Save each accepted upload in the gemstone image directory.
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },

    // Combine a timestamp, random value, and original extension for the filename.
    filename: (req, file, cb) => {
        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1E9) +
            path.extname(file.originalname);

        cb(null, uniqueName);
    }
});

// Accept only supported image formats, checking both extension and MIME type.
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extName = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
    );
    const mimeType = allowedTypes.test(file.mimetype);

    // Pass valid image files to Multer and reject other uploads.
    if (extName && mimeType) {
        cb(null, true);
    } else {
        cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed"));
    }
};

// Set the storage, file filter, and maximum image size to 5 MB.
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

// Export the configured Multer middleware for gemstone image routes.
module.exports = upload;