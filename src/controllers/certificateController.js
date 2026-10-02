const db = require("../config/db");

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
                certificate_url,
                verification_status,
                issue_date
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
                certificate_url,
                verification_status,
                issue_date,
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
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to delete certificate"
        });
    }
};


// Verify certificate by certificate number
const verifyCertificate = async (req, res) => {
    try {
        const { certificate_number } = req.params;

        const [rows] = await db.query(
            `SELECT 
                id,
                gemstone_id,
                certificate_number,
                laboratory,
                certificate_url,
                verification_status,
                issue_date,
                created_at
             FROM certificates
             WHERE certificate_number = ?`,
            [certificate_number]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Certificate not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Certificate found",
            data: rows[0]
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

    
