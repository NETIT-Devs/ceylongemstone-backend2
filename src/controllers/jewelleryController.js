const db = require("../config/db");
const {
  removeUploadedFile,
  removeUploadedFileObjects,
} = require("../utils/uploadFileCleanup");

// ─── Helper ──────────────────────────────────────────────────────────────────

// Parse an integer value and use the fallback when parsing fails.
const parseIntSafe = (value, fallback = null) => {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
};

// Parse a decimal value and use the fallback when parsing fails.
const parseFloatSafe = (value, fallback = null) => {
  const n = parseFloat(value);
  return Number.isNaN(n) ? fallback : n;
};

// Format database date values as YYYY-MM-DD, preserving missing values as null.
const dateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  return String(value).slice(0, 10);
};

// Delete an uploaded image only when no jewellery record still uses its URL.
const removeUnreferencedJewelleryImage = async (imageUrl) => {
  // Skip the reference lookup when no image URL was provided.
  if (!imageUrl) return;

  try {
    // Check for other records that reference the same image before deleting it.
    const [references] = await db.query(
      "SELECT id FROM jewellery WHERE image_url = ? LIMIT 1",
      [imageUrl]
    );
    if (references.length === 0) {
      await removeUploadedFile(imageUrl);
    }
  } catch (error) {
    console.error("Jewellery image reference check failed:", error);
  }
};

// ─── CREATE ──────────────────────────────────────────────────────────────────

exports.createJewellery = async (req, res) => {
  try {
    // Read the submitted product details, stock, image, and offer settings.
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
    } = req.body;

    // Require a non-empty product name and clean up any uploaded file on rejection.
    if (!product_name || !product_name.trim()) {
      if (req.file) await removeUploadedFileObjects([req.file]);
      return res.status(400).json({
        success: false,
        message: "product_name is required.",
      });
    }

    // Require a price before creating the jewellery item.
    if (price === undefined || price === null || price === "") {
      if (req.file) await removeUploadedFileObjects([req.file]);
      return res.status(400).json({
        success: false,
        message: "price is required.",
      });
    }

    // Use the supplied product code or generate one when it is missing.
    const code =
      product_code?.trim() ||
      `JWL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Normalize handcrafted and stock values, then derive the availability status.
    const isHandcrafted =
      is_handcrafted === true ||
      is_handcrafted === 1 ||
      is_handcrafted === "1" ||
      is_handcrafted === "true"
        ? 1
        : 0;
    const createdStockQuantity = parseIntSafe(stock_quantity, 1);

    const resolvedStatus = createdStockQuantity <= 0 ? "out_of_stock" : "active";
    const offerRate =
      offer_rate === "" || offer_rate == null
        ? null
        : parseFloatSafe(offer_rate);

    // Ensure any supplied offer rate is a valid percentage from 1 to 100.
    if (
      offer_rate !== "" &&
      offer_rate != null &&
      (!Number.isFinite(offerRate) || offerRate < 1 || offerRate > 100)
    ) {
      if (req.file) await removeUploadedFileObjects([req.file]);
      return res.status(400).json({
        success: false,
        message: "offer_rate must be between 1 and 100.",
      });
    }

    // Require valid offer dates in chronological order whenever an offer is set.
    if (
      offerRate !== null &&
      (!offer_start_date ||
        !offer_end_date ||
        dateOnly(offer_start_date) > dateOnly(offer_end_date))
    ) {
      if (req.file) await removeUploadedFileObjects([req.file]);
      return res.status(400).json({
        success: false,
        message: "A valid offer start date and end date are required.",
      });
    }

    // Associate the created record with the authenticated user when available.
    const createdBy = req.user?.id ?? null;

    // Insert the jewellery item using parameterized values.
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
        createdStockQuantity,
        req.file
          ? `/uploads/jewellery/${req.file.filename}`
          : image_url?.trim() || null,
        offerRate,
        offer_start_date || null,
        offer_end_date || null,
        isHandcrafted,
        resolvedStatus,
        createdBy,
      ]
    );

    // Return the new record ID and product code.
    return res.status(201).json({
      success: true,
      message: "Jewellery item created successfully.",
      id: result.insertId,
      product_code: code,
    });
  } catch (error) {
    // Clean up a new upload if creation fails, then report the database error.
    if (req.file) await removeUploadedFileObjects([req.file]);
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
    // Read optional filters for status and jewellery type.
    const { status, jewellery_type } = req.query;

    // Build the query conditions and parameters only for supplied filters.
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

    // Fetch matching products and normalize their offer dates for the response.
    const [rows] = await db.query(query, values);
    const jewellery = rows.map((item) => ({
      ...item,
      offer_start_date: dateOnly(item.offer_start_date),
      offer_end_date: dateOnly(item.offer_end_date),
    }));

    // Return the filtered jewellery list and its result count.
    return res.status(200).json({
      success: true,
      count: jewellery.length,
      data: jewellery,
    });
  } catch (error) {
    // Log query failures and return a server error response.
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
    // Match the requested value against either the database ID or product code.
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT * FROM jewellery WHERE id = ? OR product_code = ?",
      [id, id]
    );

    // Return 404 when no jewellery item matches the supplied identifier.
    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Jewellery item not found.",
      });
    }

    // Return the item with offer dates formatted for the API response.
    return res.status(200).json({
      success: true,
      data: {
        ...rows[0],
        offer_start_date: dateOnly(rows[0].offer_start_date),
        offer_end_date: dateOnly(rows[0].offer_end_date),
      },
    });
  } catch (error) {
    // Log query failures and return a server error response.
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
    // Read the target ID and load its current values for a partial update.
    const { id } = req.params;
    const [existing] = await db.query(
      "SELECT * FROM jewellery WHERE id = ?",
      [id]
    );

    // Clean up the new upload and return 404 if the item does not exist.
    if (!existing || existing.length === 0) {
      if (req.file) await removeUploadedFileObjects([req.file]);
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
    } = req.body;

    // Preserve existing values for omitted fields and normalize supplied values.
    const isHandcrafted =
      is_handcrafted !== undefined
        ? is_handcrafted === true ||
          is_handcrafted === 1 ||
          is_handcrafted === "1" ||
          is_handcrafted === "true"
          ? 1
          : 0
        : current.is_handcrafted;
    const updatedStockQuantity = stock_quantity !== undefined
      ? parseIntSafe(stock_quantity, current.stock_quantity)
      : current.stock_quantity;
    const updatedStatus = updatedStockQuantity <= 0 ? "out_of_stock" : "active";
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

    // Validate any supplied offer rate before applying the update.
    if (
      offer_rate !== undefined &&
      offer_rate !== "" &&
      offer_rate !== null &&
      (!Number.isFinite(updatedOfferRate) ||
        updatedOfferRate < 1 ||
        updatedOfferRate > 100)
    ) {
      if (req.file) await removeUploadedFileObjects([req.file]);
      return res.status(400).json({
        success: false,
        message: "offer_rate must be between 1 and 100.",
      });
    }

    // Require both offer dates and ensure the end date is not before the start.
    if (
      updatedOfferRate !== null &&
      (!updatedOfferStartDate ||
        !updatedOfferEndDate ||
        dateOnly(updatedOfferStartDate) > dateOnly(updatedOfferEndDate))
    ) {
      if (req.file) await removeUploadedFileObjects([req.file]);
      return res.status(400).json({
        success: false,
        message: "A valid offer start date and end date are required.",
      });
    }

    // Update the item while preserving fields omitted from the request.
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
        updatedStockQuantity,
        req.file
          ? `/uploads/jewellery/${req.file.filename}`
          : image_url !== undefined
            ? image_url?.trim() || null
            : current.image_url,
        updatedOfferRate,
        updatedOfferStartDate,
        updatedOfferEndDate,
        isHandcrafted,
        updatedStatus,
        id,
      ]
    );

    // Return 404 if no row was updated.
    if (updateResult.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Jewellery item not found.",
      });
    }

    // Remove the previous image only when it changed and is no longer referenced.
    const updatedImageUrl = req.file
      ? `/uploads/jewellery/${req.file.filename}`
      : image_url !== undefined
        ? image_url?.trim() || null
        : current.image_url;
    if (updatedImageUrl !== current.image_url) {
      await removeUnreferencedJewelleryImage(current.image_url);
    }

    // Confirm that the jewellery item was updated.
    return res.status(200).json({
      success: true,
      message: "Jewellery item updated successfully.",
    });
  } catch (error) {
    // Clean up a new upload if the update fails and report the error.
    if (req.file) await removeUploadedFileObjects([req.file]);
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
  // Keep status derived from stock quantity rather than allowing manual changes.
  return res.status(409).json({
    success: false,
    message: "Jewellery status is managed automatically from stock quantity.",
  });
};

exports.getPendingJewellery = async (req, res) => {
  try {
    // Fetch pending jewellery submissions, newest first.
    const [rows] = await db.query(
      `SELECT id, product_code, product_name, jewellery_type, gemstone_type,
              color, description, material, price, currency, stock_quantity,
              image_url, is_handcrafted, status, created_at
       FROM jewellery
       WHERE status = 'pending'
       ORDER BY created_at DESC, id DESC`
    );

    // Return the pending items and their count.
    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    // Log query failures and return a server error response.
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
    // Load the item and its image URL before deleting the database record.
    const { id } = req.params;
    const [existing] = await db.query(
      "SELECT image_url FROM jewellery WHERE id = ?",
      [id]
    );

    // Return 404 when the requested item does not exist.
    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: "Jewellery item not found.",
      });
    }

    // Delete the jewellery record by its database ID.
    const [result] = await db.query(
      "DELETE FROM jewellery WHERE id = ?",
      [id]
    );

    // Return 404 if no row was deleted.
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Jewellery item not found.",
      });
    }

    // Delete the image file only if no remaining item references it.
    await removeUnreferencedJewelleryImage(existing[0].image_url);

    // Confirm that the item was deleted.
    return res.status(200).json({
      success: true,
      message: "Jewellery item deleted successfully.",
    });
  } catch (error) {
    // Log deletion failures and return a server error response.
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
    // Set the stock quantity that defines a low-stock jewellery item.
    const threshold = 3;

    // Fetch matching items in ascending stock order.
    const [rows] = await db.query(
      `SELECT id, product_code, product_name, jewellery_type, stock_quantity, price, status
       FROM jewellery
       WHERE stock_quantity <= ?
       ORDER BY stock_quantity ASC`,
      [threshold]
    );

    // Return the low-stock items, threshold, and result count.
    return res.status(200).json({
      success: true,
      message: "Low stock jewellery items fetched successfully.",
      threshold,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    // Log query failures and return a server error response.
    console.error("Low Stock Jewellery Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch low stock jewellery.",
      error: error.message,
    });
  }
};
