const express = require("express");
const uploadCertificate = require("../middleware/certificateUpload");

const {
    addCertificate,
    getAllCertificates,
    getCertificateById,
    updateCertificate,
    deleteCertificate,
    verifyCertificate
} = require("../controllers/certificateController");

const router = express.Router();

router.post("/", uploadCertificate, addCertificate);
router.get("/", getAllCertificates);
router.get("/:id", getCertificateById);
router.put("/:id", uploadCertificate, updateCertificate);
router.delete("/:id", deleteCertificate);
router.get("/verify/:certificate_number", verifyCertificate);

module.exports = router;