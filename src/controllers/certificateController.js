const db = require("../config/db");
const fs = require("fs/promises");
const path = require("path");

const certificateUploadDirectory = path.resolve(__dirname, "../../uploads/certificates");

const getManagedCertificatePath = (certificateUrl) => {
    if (typeof certificateUrl !== "string") {
        return null;
    }

    const match = certificateUrl.match(/^\/uploads\/certificates\/([^/\\]+)$/);
    if (!match) {
        return null;
    }

    const filePath = path.resolve(certificateUploadDirectory, match[1]);
    return path.dirname(filePath) === certificateUploadDirectory ? filePath : null;
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

        if (!gemstone_id || !certificate_number || !laboratory) {
            return res.status(400).json({
                success: false,
                message: "Gemstone ID, certificate number and laboratory are required"
            });
        }

        const [result] = await db.query(
            `INSERT INTO certificates
            (gemstone_id, certificate_number, laboratory, certificate_url, verification_status, issue_date)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                gemstone_id,
                certificate_number,
                laboratory,
                req.file ? `/uploads/certificates/${req.file.filename}` : certificate_url || null,
                verification_status || "PENDING",
                issue_date || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Certificate added successfully",
            certificate_id: result.insertId
        });

    } catch (error) {
        console.error("Add Certificate Error:", error);

        res.status(500).json({
            success: false,
            message: "Error adding certificate",
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
            certificate_number,
            laboratory,
            certificate_url,
            verification_status,
            issue_date
        } = req.body;

        const [result] = await db.query(
            `UPDATE certificates
             SET certificate_number = ?,
                 laboratory = ?,
                 certificate_url = ?,
                 verification_status = ?,
                 issue_date = ?
             WHERE id = ?`,
            [
                certificate_number,
                laboratory,
                req.file ? `/uploads/certificates/${req.file.filename}` : certificate_url || null,
                verification_status || "pending",
                issue_date || null,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Certificate not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Certificate updated successfully"
        });

    } catch (error) {
        console.error("Update Certificate Error:", error);

        res.status(500).json({
            success: false,
            message: "Error updating certificate",
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

        const certificatePath = getManagedCertificatePath(certificates[0].certificate_url);
        if (certificatePath) {
            const [references] = await db.query(
                "SELECT id FROM certificates WHERE certificate_url = ? AND id <> ? LIMIT 1",
                [certificates[0].certificate_url, id]
            );

            if (references.length === 0) {
                try {
                    await fs.unlink(certificatePath);
                } catch (error) {
                    if (error.code !== "ENOENT") {
                        throw error;
                    }
                }
            }
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

    
