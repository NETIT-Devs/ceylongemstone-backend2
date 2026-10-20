const db = require("../config/db");
const {
    removeUploadedFile,
    removeUploadedFileObjects
} = require("../utils/uploadFileCleanup");

const getUploadedCertificate = (req) =>
    req.file || req.files?.certificate?.[0] || req.files?.certificate_url?.[0] || null;

const removeUploadedCertificate = async (req) => {
    const files = req.file
        ? [req.file]
        : Object.values(req.files || {}).flat();
    await removeUploadedFileObjects(files);
};

const removeReplacedCertificate = async (certificateUrl) => {
    try {
        const [references] = await db.query(
            "SELECT id FROM certificates WHERE certificate_url = ? LIMIT 1",
            [certificateUrl]
        );
        if (references.length === 0) {
            await removeUploadedFile(certificateUrl);
        }
    } catch (error) {
        console.error("Replaced certificate file cleanup failed:", error);
    }
};

const validateCertificateFields = async ({ gemstoneId, certificateNumber, laboratory, status, issueDate }) => {
    if (!Number.isSafeInteger(Number(gemstoneId)) || Number(gemstoneId) < 1) {
        return "A valid gemstone ID is required.";
    }
    if (!String(certificateNumber || "").trim() || !String(laboratory || "").trim()) {
        return "Certificate number and laboratory are required.";
    }
    if (!["VERIFIED", "PENDING", "REJECTED"].includes(String(status || "").toUpperCase())) {
        return "Verification status must be VERIFIED, PENDING, or REJECTED.";
    }
    if (issueDate) {
        const normalizedDate = issueDate instanceof Date
            ? issueDate.toISOString().slice(0, 10)
            : String(issueDate).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
            return "Issue date must be in YYYY-MM-DD format.";
        }
        const parsedDate = new Date(`${normalizedDate}T00:00:00.000Z`);
        if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== normalizedDate) {
            return "Issue date must be a valid calendar date.";
        }
    }

    const [gemstones] = await db.query("SELECT id FROM gemstones WHERE id = ?", [Number(gemstoneId)]);
    return gemstones.length ? null : "The linked gemstone does not exist.";
};

const getUploadedCertificateUrl = (req, fallbackUrl = null) => {
    const file = getUploadedCertificate(req);
    return file ? `/uploads/certificates/${file.filename}` : fallbackUrl;
};

// Add certificate
const addCertificate = async (req, res) => {
    try {
        const {
            gemstone_id,
            certificate_number,
            laboratory,
            certificate_url,
            verification_status,
            issue_date
        } = req.body;

        const normalizedStatus = String(verification_status || "PENDING").toUpperCase();
        const validationError = await validateCertificateFields({
            gemstoneId: gemstone_id,
            certificateNumber: certificate_number,
            laboratory,
            status: normalizedStatus,
            issueDate: issue_date
        });
        if (validationError) {
            await removeUploadedCertificate(req);
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const [result] = await db.query(
            `INSERT INTO certificates
            (gemstone_id, certificate_number, laboratory, certificate_url, verification_status, issue_date)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                gemstone_id,
                String(certificate_number).trim(),
                laboratory.trim(),
                getUploadedCertificateUrl(req, certificate_url || null),
                normalizedStatus,
                issue_date || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Certificate added successfully",
            certificate_id: result.insertId
        });

    } catch (error) {
        await removeUploadedCertificate(req);
        console.error("Add Certificate Error:", error);

        res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
            success: false,
            message: error.code === "ER_DUP_ENTRY"
                ? "A certificate with this certificate number already exists."
                : "Error adding certificate",
            error: error.message
        });
    }
};

// Get all certificates
const getAllCertificates = async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM certificates ORDER BY created_at DESC"
        );

        res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("Get Certificates Error:", error);

        res.status(500).json({
            success: false,
            message: "Error fetching certificates",
            error: error.message
        });
    }
};

// Get certificate by ID
const getCertificateById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            "SELECT * FROM certificates WHERE id = ?",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Certificate not found"
            });
        }

        res.status(200).json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error("Get Certificate Error:", error);

        res.status(500).json({
            success: false,
            message: "Error fetching certificate",
            error: error.message
        });
    }
};

// Update certificate
const updateCertificate = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            gemstone_id,
            certificate_number,
            laboratory,
            certificate_url,
            verification_status,
            issue_date
        } = req.body;

        const [existingRows] = await db.query(
            "SELECT * FROM certificates WHERE id = ?",
            [id]
        );
        if (!existingRows.length) {
            await removeUploadedCertificate(req);
            return res.status(404).json({
                success: false,
                message: "Certificate not found"
            });
        }
        const current = existingRows[0];
        const gemstoneId = gemstone_id === undefined ? current.gemstone_id : gemstone_id;
        const certificateNumber = certificate_number === undefined
            ? current.certificate_number
            : String(certificate_number).trim();
        const certificateLaboratory = laboratory === undefined
            ? current.laboratory
            : String(laboratory).trim();
        const normalizedStatus = String(
            verification_status === undefined ? current.verification_status : verification_status
        ).toUpperCase();
        const issueDate = issue_date === undefined ? current.issue_date : issue_date;
        const validationError = await validateCertificateFields({
            gemstoneId,
            certificateNumber,
            laboratory: certificateLaboratory,
            status: normalizedStatus,
            issueDate
        });
        if (validationError) {
            await removeUploadedCertificate(req);
            return res.status(400).json({ success: false, message: validationError });
        }

        const updatedCertificateUrl = getUploadedCertificateUrl(
            req,
            certificate_url === undefined || certificate_url === ""
                ? current.certificate_url
                : certificate_url
        );
        await db.query(
            `UPDATE certificates
             SET gemstone_id = ?,
                 certificate_number = ?,
                 laboratory = ?,
                 certificate_url = ?,
                 verification_status = ?,
                 issue_date = ?
             WHERE id = ?`,
             [
                 gemstoneId,
                 certificateNumber,
                 certificateLaboratory,
                 updatedCertificateUrl,
                 normalizedStatus,
                 issueDate || null,
                 id
             ]
        );

        if (updatedCertificateUrl !== current.certificate_url) {
             await removeReplacedCertificate(current.certificate_url);
        }

        res.status(200).json({
            success: true,
            message: "Certificate updated successfully"
        });

    } catch (error) {
        await removeUploadedCertificate(req);
        console.error("Update Certificate Error:", error);

        res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
            success: false,
            message: error.code === "ER_DUP_ENTRY"
                ? "A certificate with this certificate number already exists."
                : "Error updating certificate",
            error: error.message
        });
    }
};

//Delete certificate
const deleteCertificate = async (req, res) => {
    try {
        const { id } = req.params;

        const [certificates] = await db.query(
            "SELECT certificate_url FROM certificates WHERE id = ?",
            [id]
        );

        if (certificates.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Certificate not found"
            });
        }

        const [result] = await db.query(
            "DELETE FROM certificates WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Certificate not found"
            });
        }

        await removeReplacedCertificate(certificates[0].certificate_url);

        res.json({
            success: true,
            message: "Certificate deleted successfully"
        });

    } catch (error) {
        console.error("Delete Certificate Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete certificate"
        });
    }
};


// Search for a certificate by certificate number or linked gemstone reference.
const verifyCertificate = async (req, res) => {
    try {
        const searchCode = String(
            req.query.code || req.query.q || req.params.certificate_number || ""
        ).trim();

        if (!searchCode) {
            return res.status(400).json({
                success: false,
                message: "Enter a certificate number or gemstone reference ID to search."
            });
        }

        const [rows] = await db.query(
            `SELECT 
                cert.id,
                cert.gemstone_id,
                cert.certificate_number,
                cert.laboratory,
                cert.certificate_url,
                cert.verification_status,
                cert.issue_date,
                cert.created_at,
                g.id AS linked_gemstone_id,
                g.gemstone_id AS gemstone_reference,
                g.category_id,
                g.name AS gemstone_name,
                g.color,
                g.carat,
                g.length,
                g.width,
                g.height,
                g.clarity,
                g.cut,
                g.shape,
                g.origin,
                g.treatment_status,
                g.price,
                g.stock,
                g.description,
                g.status AS gemstone_status,
                category.name AS category_name,
                (
                    SELECT gi.image_url
                    FROM gemstone_images gi
                    WHERE gi.gemstone_id = g.id
                      AND gi.image_type IN ('front', 'main')
                    ORDER BY gi.is_primary DESC, gi.id ASC
                    LIMIT 1
                ) AS gemstone_image
             FROM certificates cert
             INNER JOIN gemstones g ON g.id = cert.gemstone_id
             LEFT JOIN categories category ON category.id = g.category_id
             WHERE LOWER(cert.certificate_number) = LOWER(?)
                OR LOWER(g.gemstone_id) = LOWER(?)
                OR CAST(g.id AS CHAR) = ?
             ORDER BY cert.created_at DESC, cert.id DESC
             LIMIT 1`,
            [searchCode, searchCode, searchCode]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No certificate or gemstone record matches "${searchCode}". Check the code and try again.`
            });
        }

        const row = rows[0];
        const data = {
            id: row.id,
            certificate_id: row.id,
            gemstone_id: row.gemstone_id,
            certificate_number: row.certificate_number,
            laboratory: row.laboratory,
            certificate_url: row.certificate_url,
            verification_status: row.verification_status,
            issue_date: row.issue_date,
            created_at: row.created_at,
            verified: String(row.verification_status).toUpperCase() === "VERIFIED",
            gemstone: {
                id: row.linked_gemstone_id,
                gemstone_id: row.gemstone_reference,
                category_id: row.category_id,
                category_name: row.category_name,
                name: row.gemstone_name,
                color: row.color,
                carat: row.carat,
                length: row.length,
                width: row.width,
                height: row.height,
                clarity: row.clarity,
                cut: row.cut,
                shape: row.shape,
                origin: row.origin,
                treatment_status: row.treatment_status,
                price: row.price,
                stock: row.stock,
                description: row.description,
                status: row.gemstone_status,
                image: row.gemstone_image
            }
        };

        res.status(200).json({
            success: true,
            message: data.verified
                ? "Verified certificate found."
                : "Certificate record found; its verification status is not verified.",
            data
        });

    } catch (error) {
        console.error("Verify Certificate Error:", error);

        res.status(500).json({
            success: false,
            message: "Error verifying certificate",
            error: error.message
        });
    }
};


module.exports = {
    addCertificate,
    getAllCertificates,
    getCertificateById,
    updateCertificate,
    deleteCertificate,
    verifyCertificate
};

    
