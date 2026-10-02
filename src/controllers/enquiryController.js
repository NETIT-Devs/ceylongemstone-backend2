const db = require("../config/db");

// Create Enquiry
exports.createEnquiry = async (req, res) => {
  try {
    const {
      user_id,
      gemstone_id,
      name,
      email,
      message
    } = req.body;

    if (!gemstone_id || !name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "gemstone_id, name, email and message are required"
      });
    }

    // Check gemstone exists
    const [gemstone] = await db.query(
      "SELECT id FROM gemstones WHERE id = ? OR gemstone_id = ?",
      [gemstone_id, gemstone_id]
    );

    if (gemstone.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gemstone not found"
      });
    }

    const gemstoneDbId = gemstone[0].id;

    const [result] = await db.query(
      `INSERT INTO enquiries
       (user_id, gemstone_id, name, email, message, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', NOW())`,
      [
        user_id || null,
        gemstoneDbId,
        name,
        email,
        message
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Enquiry submitted successfully",
      enquiry_id: result.insertId
    });

  } catch (error) {
    console.error("Create Enquiry Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit enquiry",
      error: error.message
    });
  }
};

// Get all enquiries
exports.getEnquiries = async (req, res) => {
  try {
    const [enquiries] = await db.query(
      `SELECT
        e.id,
        e.user_id,
        e.gemstone_id,
        g.gemstone_id AS gemstone_code,
        g.name AS gemstone_name,
        e.name,
        e.email,
        e.message,
        e.status,
        e.created_at
      FROM enquiries e
      INNER JOIN gemstones g ON e.gemstone_id = g.id
      ORDER BY e.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      data: enquiries
    });

  } catch (error) {
    console.error("Get Enquiries Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch enquiries",
      error: error.message
    });
  }
};

// Update Enquiry Status
exports.updateEnquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["PENDING", "CONTACTED", "CLOSED"];

    if (!status || !allowedStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Status must be PENDING, CONTACTED or CLOSED"
      });
    }

    const [enquiry] = await db.query(
      "SELECT id FROM enquiries WHERE id = ?",
      [id]
    );

    if (enquiry.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found"
      });
    }

    const updatedStatus = status.toUpperCase();

    await db.query(
      "UPDATE enquiries SET status = ? WHERE id = ?",
      [updatedStatus, id]
    );

    return res.status(200).json({
      success: true,
      message: "Enquiry status updated successfully",
      enquiry_id: Number(id),
      status: updatedStatus
    });

  } catch (error) {
    console.error("Update Enquiry Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update enquiry status",
      error: error.message
    });
  }
};

// Delete Enquiry
exports.deleteEnquiry = async (req, res) => {
  try {
    const { id } = req.params;

    const [enquiry] = await db.query(
      "SELECT id FROM enquiries WHERE id = ?",
      [id]
    );

    if (enquiry.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found"
      });
    }

    await db.query(
      "DELETE FROM enquiries WHERE id = ?",
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Enquiry deleted successfully"
    });

  } catch (error) {
    console.error("Delete Enquiry Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete enquiry",
      error: error.message
    });
  }
};