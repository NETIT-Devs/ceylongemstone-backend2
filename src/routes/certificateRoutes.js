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
router.get("/verify", verifyCertificate);
router.get("/verify/:certificate_number", verifyCertificate);
router.get("/:id", getCertificateById);
router.put("/:id", uploadCertificate, updateCertificate);
router.delete("/:id", deleteCertificate);

module.exports = router;