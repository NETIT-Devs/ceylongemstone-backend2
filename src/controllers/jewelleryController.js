const db = require("../config/db");

// ─── Helper ──────────────────────────────────────────────────────────────────

const parseIntSafe = (value, fallback = null) => {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
};

const parseFloatSafe = (value, fallback = null) => {
  const n = parseFloat(value);
  return Number.isNaN(n) ? fallback : n;
};

const dateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  return String(value).slice(0, 10);
};

// ─── CREATE ──────────────────────────────────────────────────────────────────

exports.createJewellery = async (req, res) => {
  try {
    const {
      product_code,
      product_name,
      jewellery_type,
      gemstone_type,
      color,
      description,
      material,
      price,
      currency,
      stock_quantity,
      image_url,
      offer_rate,
      offer_start_date,
      offer_end_date,
      is_handcrafted,
      status,
    } = req.body;

    if (!product_name || !product_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "product_name is required.",
      });
    }

    if (price === undefined || price === null || price === "") {
      return res.status(400).json({
        success: false,
        message: "price is required.",
      });
    }

    // Auto-generate product_code if not supplied
    const code =
      product_code?.trim() ||
      `JWL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const isHandcrafted =
      is_handcrafted === true ||
      is_handcrafted === 1 ||
      is_handcrafted === "1" ||
      is_handcrafted === "true"
        ? 1
        : 0;

    const validStatuses = [
      "pending",
      "approved",
      "rejected",
      "active",
      "inactive",
      "draft",
    ];
    const resolvedStatus = req.user.role === "ADMIN"
      ? "pending"
      : validStatuses.includes(status)
        ? status
        : "pending";
    const offerRate =
      offer_rate === "" || offer_rate == null
        ? null
        : parseFloatSafe(offer_rate);

    if (
      offer_rate !== "" &&
      offer_rate != null &&
      (!Number.isFinite(offerRate) || offerRate < 1 || offerRate > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "offer_rate must be between 1 and 100.",
      });
    }
    if (
      offerRate !== null &&
      (!offer_start_date ||
        !offer_end_date ||
        dateOnly(offer_start_date) > dateOnly(offer_end_date))
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid offer start date and end date are required.",
      });
    }

    const createdBy = req.user?.id ?? null;

    const [result] = await db.query(
      `INSERT INTO jewellery
         (product_code, product_name, jewellery_type, gemstone_type, color,
          description, material, price, currency, stock_quantity,
           image_url, offer_rate, offer_start_date, offer_end_date,
           is_handcrafted, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        product_name.trim(),
        jewellery_type?.trim() || null,
        gemstone_type?.trim() || null,
        color?.trim() || null,
        description?.trim() || null,
        material?.trim() || null,
        parseFloatSafe(price),
        currency?.trim() || "USD",
        parseIntSafe(stock_quantity, 1),
        req.file
          ? `/uploads/gemstones/${req.file.filename}`
          : image_url?.trim() || null,
        offerRate,
        offer_start_date || null,
        offer_end_date || null,
        isHandcrafted,
        resolvedStatus,
        createdBy,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Jewellery item created successfully.",
      id: result.insertId,
      product_code: code,
    });
  } catch (error) {
    console.error("Create Jewellery Error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A jewellery item with this product_code already exists.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to create jewellery item.",
      error: error.message,
    });
  }
};

// ─── READ ALL ─────────────────────────────────────────────────────────────────

exports.getAllJewellery = async (req, res) => {
  try {
    const { status, jewellery_type } = req.query;

    let query = "SELECT * FROM jewellery";
    const conditions = [];
    const values = [];

    if (status) {
      conditions.push("status = ?");
      values.push(status);
    }
    if (jewellery_type) {
      conditions.push("jewellery_type = ?");
      values.push(jewellery_type);
    }
    if (conditions.length) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY id DESC";

    const [rows] = await db.query(query, values);
    const jewellery = rows.map((item) => ({
      ...item,
      offer_start_date: dateOnly(item.offer_start_date),
      offer_end_date: dateOnly(item.offer_end_date),
    }));

    return res.status(200).json({
      success: true,
      count: jewellery.length,
      data: jewellery,
    });
  } catch (error) {
    console.error("Get All Jewellery Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch jewellery items.",
      error: error.message,
    });
  }
};

// ─── READ ONE ─────────────────────────────────────────────────────────────────

exports.getJewelleryById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT * FROM jewellery WHERE id = ? OR product_code = ?",
      [id, id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Jewellery item not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...rows[0],
        offer_start_date: dateOnly(rows[0].offer_start_date),
        offer_end_date: dateOnly(rows[0].offer_end_date),
      },
    });
  } catch (error) {
    console.error("Get Jewellery By Id Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch jewellery item.",
      error: error.message,
    });
  }
};

// ─── UPDATE ──────────────────────────────────────────────────────────────────

exports.updateJewellery = async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.query(
      "SELECT * FROM jewellery WHERE id = ?",
      [id]
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Jewellery item not found.",
      });
    }

    const current = existing[0];
    const {
      product_code,
      product_name,
      jewellery_type,
      gemstone_type,
      color,
      description,
      material,
      price,
      currency,
      stock_quantity,
      image_url,
      offer_rate,
      offer_start_date,
      offer_end_date,
      is_handcrafted,
      status,
    } = req.body;

    const validStatuses = [
      "pending",
      "approved",
      "rejected",
      "active",
      "inactive",
      "draft",
    ];

    const isHandcrafted =
      is_handcrafted !== undefined
        ? is_handcrafted === true ||
          is_handcrafted === 1 ||
          is_handcrafted === "1" ||
          is_handcrafted === "true"
          ? 1
          : 0
        : current.is_handcrafted;
    const updatedOfferRate =
      offer_rate !== undefined
        ? offer_rate === "" || offer_rate === null
          ? null
          : parseFloatSafe(offer_rate)
        : current.offer_rate;
    const updatedOfferStartDate =
      offer_start_date !== undefined
        ? offer_start_date || null
        : current.offer_start_date;
    const updatedOfferEndDate =
      offer_end_date !== undefined
        ? offer_end_date || null
        : current.offer_end_date;

    if (
      offer_rate !== undefined &&
      offer_rate !== "" &&
      offer_rate !== null &&
      (!Number.isFinite(updatedOfferRate) ||
        updatedOfferRate < 1 ||
        updatedOfferRate > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "offer_rate must be between 1 and 100.",
      });
    }
    if (
      updatedOfferRate !== null &&
      (!updatedOfferStartDate ||
        !updatedOfferEndDate ||
        dateOnly(updatedOfferStartDate) > dateOnly(updatedOfferEndDate))
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid offer start date and end date are required.",
      });
    }

    const [updateResult] = await db.query(
      `UPDATE jewellery SET
         product_code    = ?,
         product_name    = ?,
         jewellery_type  = ?,
         gemstone_type   = ?,
         color           = ?,
         description     = ?,
         material        = ?,
         price           = ?,
         currency        = ?,
         stock_quantity  = ?,
         image_url       = ?,
         offer_rate      = ?,
         offer_start_date = ?,
         offer_end_date   = ?,
         is_handcrafted  = ?,
         status          = ?
       WHERE id = ?`,
      [
        product_code?.trim() ?? current.product_code,
        product_name?.trim() ?? current.product_name,
        jewellery_type !== undefined ? jewellery_type?.trim() || null : current.jewellery_type,
        gemstone_type !== undefined ? gemstone_type?.trim() || null : current.gemstone_type,
        color !== undefined ? color?.trim() || null : current.color,
        description !== undefined ? description?.trim() || null : current.description,
        material !== undefined ? material?.trim() || null : current.material,
        price !== undefined ? parseFloatSafe(price, current.price) : current.price,
        currency?.trim() ?? current.currency,
        stock_quantity !== undefined
          ? parseIntSafe(stock_quantity, current.stock_quantity)
          : current.stock_quantity,
        req.file
          ? `/uploads/gemstones/${req.file.filename}`
          : image_url !== undefined
            ? image_url?.trim() || null
            : current.image_url,
        updatedOfferRate,
        updatedOfferStartDate,
        updatedOfferEndDate,
        isHandcrafted,
        req.user.role === "ADMIN"
          ? current.status
          : status !== undefined && validStatuses.includes(status)
            ? status
            : current.status,
        id,
      ]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Jewellery item not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Jewellery item updated successfully.",
    });
  } catch (error) {
    console.error("Update Jewellery Error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Another jewellery item already uses this product_code.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to update jewellery item.",
      error: error.message,
    });
  }
};

// ─── UPDATE STATUS (APPROVE / REJECT / ETC) ──────────────────────────────────

exports.updateJewelleryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Approval status must be approved or rejected.",
      });
    }

    const [result] = await db.query(
      "UPDATE jewellery SET status = ? WHERE id = ? AND status = 'pending'",
      [status, id]
    );

    if (result.affectedRows === 0) {
      const [rows] = await db.query(
        "SELECT id FROM jewellery WHERE id = ?",
        [id]
      );
      return res.status(rows.length ? 409 : 404).json({
        success: false,
        message: rows.length
          ? "Jewellery item is no longer awaiting approval."
          : "Jewellery item not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Jewellery status updated to '${status}' successfully.`,
      status,
    });
  } catch (error) {
    console.error("Update Jewellery Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update jewellery status.",
      error: error.message,
    });
  }
};

exports.getPendingJewellery = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, product_code, product_name, jewellery_type, gemstone_type,
              color, description, material, price, currency, stock_quantity,
              image_url, is_handcrafted, status, created_at
       FROM jewellery
       WHERE status = 'pending'
       ORDER BY created_at DESC, id DESC`
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error("Fetch Pending Jewellery Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending jewellery.",
      error: error.message
    });
  }
};

// ─── DELETE ──────────────────────────────────────────────────────────────────

exports.deleteJewellery = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      "DELETE FROM jewellery WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Jewellery item not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Jewellery item deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Jewellery Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete jewellery item.",
      error: error.message,
    });
  }
};

// ─── LOW STOCK ────────────────────────────────────────────────────────────────

exports.getLowStockJewellery = async (req, res) => {
  try {
    const threshold = 3;
    const [rows] = await db.query(
      `SELECT id, product_code, product_name, jewellery_type, stock_quantity, price, status
       FROM jewellery
       WHERE stock_quantity <= ?
       ORDER BY stock_quantity ASC`,
      [threshold]
    );

    return res.status(200).json({
      success: true,
      message: "Low stock jewellery items fetched successfully.",
      threshold,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Low Stock Jewellery Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch low stock jewellery.",
      error: error.message,
    });
  }
};
