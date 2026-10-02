const db = require("../config/db");

// Create Gemstone
exports.createGemstone = async (req, res) => {
  try {
    const {
      gemstone_id,
      category_id,
      name,
      color,
      carat,
      length,
      width,
      height,
      clarity,
      cut,
      shape,
      origin,
      treatment_status,
      price,
      stock,
      description,
      status,
    } = req.body;

    if (!name || !category_id) {
      return res.status(400).json({
        success: false,
        message: "Gemstone name and category_id are required",
      });
    }

    // Verify category exists
    const [categories] = await db.query("SELECT id FROM categories WHERE id = ?", [category_id]);
    if (!categories || categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Category with ID ${category_id} does not exist. Please create or specify a valid category.`,
      });
    }

    // Auto-generate gemstone_id if not provided
    const gemId = gemstone_id || `GEM-${Date.now()}`;

    // Convert status to tinyint(1) (1 for available/active, 0 otherwise)
    const statusVal =
      status === undefined ||
      status === 1 ||
      status === true ||
      status === "available" ||
      status === "active"
        ? 1
        : 0;

    const query = `
      INSERT INTO gemstones 
      (gemstone_id, category_id, name, color, carat, length, width, height, clarity, cut, shape, origin, treatment_status, price, stock, description, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      gemId,
      category_id,
      name,
      color || null,
      carat ? parseFloat(carat) : null,
      length ? parseFloat(length) : null,
      width ? parseFloat(width) : null,
      height ? parseFloat(height) : null,
      clarity || null,
      cut || null,
      shape || null,
      origin || null,
      treatment_status || null,
      price ? parseFloat(price) : null,
      stock !== undefined ? parseInt(stock, 10) : 1,
      description || null,
      statusVal,
    ];

    const [result] = await db.query(query, values);

    return res.status(201).json({
      success: true,
      message: "Gemstone successfully added!",
      id: result.insertId,
      gemstone_id: gemId,
    });
  } catch (error) {
    console.error("Create Gemstone Error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Gemstone with this gemstone_id already exists",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to add gemstone",
      error: error.message,
    });
  }
};

// Get all gemstones (with category names)
exports.getAllGemstones = async (req, res) => {
  try {
    const query = `
      SELECT g.*, c.name AS category_name 
      FROM gemstones g 
      LEFT JOIN categories c ON g.category_id = c.id
      ORDER BY g.id DESC
    `;
    const [rows] = await db.query(query);

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Fetch Gemstones Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching gemstones",
      error: error.message,
    });
  }
};

// Get single gemstone by id or gemstone_id with certificate
exports.getGemstoneById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        g.*,
        c.name AS category_name,
        cert.id AS certificate_id,
        cert.certificate_number,
        cert.laboratory,
        cert.certificate_url,
        cert.verification_status,
        cert.issue_date
      FROM gemstones g
      LEFT JOIN categories c ON g.category_id = c.id
      LEFT JOIN certificates cert ON g.id = cert.gemstone_id
      WHERE g.id = ? OR g.gemstone_id = ?
    `;

    const [rows] = await db.query(query, [id, id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gemstone not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });

  } catch (error) {
    console.error("Fetch Gemstone Error:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching gemstone",
      error: error.message,
    });
  }
};

// Update gemstone
exports.updateGemstone = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      category_id,
      color,
      carat,
      length,
      width,
      height,
      clarity,
      cut,
      shape,
      origin,
      treatment_status,
      price,
      stock,
      description,
      status,
    } = req.body;

    const [existing] = await db.query("SELECT * FROM gemstones WHERE id = ?", [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gemstone not found",
      });
    }

    const current = existing[0];
    const statusVal = status !== undefined
      ? (status === 1 || status === true || status === "available" || status === "active" ? 1 : 0)
      : current.status;

    const query = `
      UPDATE gemstones SET
        name = ?,
        category_id = ?,
        color = ?,
        carat = ?,
        length = ?,
        width = ?,
        height = ?,
        clarity = ?,
        cut = ?,
        shape = ?,
        origin = ?,
        treatment_status = ?,
        price = ?,
        stock = ?,
        description = ?,
        status = ?
      WHERE id = ?
    `;

    const values = [
      name !== undefined ? name : current.name,
      category_id !== undefined ? category_id : current.category_id,
      color !== undefined ? color : current.color,
      carat !== undefined ? carat : current.carat,
      length !== undefined ? length : current.length,
      width !== undefined ? width : current.width,
      height !== undefined ? height : current.height,
      clarity !== undefined ? clarity : current.clarity,
      cut !== undefined ? cut : current.cut,
      shape !== undefined ? shape : current.shape,
      origin !== undefined ? origin : current.origin,
      treatment_status !== undefined ? treatment_status : current.treatment_status,
      price !== undefined ? price : current.price,
      stock !== undefined ? stock : current.stock,
      description !== undefined ? description : current.description,
      statusVal,
      id,
    ];

    await db.query(query, values);

    return res.status(200).json({
      success: true,
      message: "Gemstone updated successfully",
    });
  } catch (error) {
    console.error("Update Gemstone Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update gemstone",
      error: error.message,
    });
  }
};

// Delete gemstone
exports.deleteGemstone = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query("DELETE FROM gemstones WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Gemstone not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Gemstone deleted successfully",
    });
  } catch (error) {
    console.error("Delete Gemstone Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete gemstone",
      error: error.message,
    });
  }
};