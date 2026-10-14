const db = require("../config/db");
const fs = require("fs");

const treatmentAliases = {
  unheated: ["unheated", "untreated", "natural"],
  heated: ["heated"],
  "no indication of heating": [
    "no indication of heating",
    "no indication heating",
    "no evidence of heating",
    "no evidence heating",
  ],
  "beryllium treated": ["beryllium treated", "beryllium treatment", "beryllium"],
};

const normalizeTreatment = (value) =>
  String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const mediaFields = [
  { field: "mainImage", type: "front", primary: true },
  { field: "backViewImage", type: "back" },
  { field: "rightViewImage", type: "right" },
  { field: "leftViewImage", type: "left" },
  { field: "videoClip", type: "video" },
];

const removeUploadedFiles = async (req) => {
  const files = Object.values(req.files || {}).flat();
  const results = await Promise.allSettled(
    files.map((file) => fs.promises.unlink(file.path))
  );
  results
    .filter((result) => result.status === "rejected")
    .forEach((result) => console.error("Uploaded media cleanup failed:", result.reason));
};

const attachGemstoneMedia = async (gemstones) => {
  if (!gemstones.length) return gemstones;

  const ids = gemstones.map((gemstone) => gemstone.id);
  const placeholders = ids.map(() => "?").join(", ");
  const [mediaRows] = await db.query(
    `SELECT gemstone_id, image_url, image_type, is_primary
     FROM gemstone_images
     WHERE gemstone_id IN (${placeholders})
     ORDER BY id ASC`,
    ids
  );
  const mediaByGemstone = new Map();

  for (const media of mediaRows) {
    const items = mediaByGemstone.get(media.gemstone_id) || [];
    items.push(media);
    mediaByGemstone.set(media.gemstone_id, items);
  }

  return gemstones.map((gemstone) => {
    const media = mediaByGemstone.get(gemstone.id) || [];
    const imageFor = (type) =>
      media.find((item) => item.image_type === type)?.image_url || null;
    const frontMedia =
      media.find((item) => ["front", "main"].includes(item.image_type)) ||
      media.find(
        (item) => Number(item.is_primary) === 1 && item.image_type !== "video"
      );
    const front = frontMedia?.image_url || null;
    const galleryViews = [
      ["Front", front],
      ["Back", imageFor("back")],
      ["Right", imageFor("right")],
      ["Left", imageFor("left")],
    ]
      .filter(([, url]) => url)
      .map(([label, url]) => ({ label, url }));
    const additionalImages = media
      .filter(
        (item) =>
          item.image_url &&
          item !== frontMedia &&
          !["front", "main", "back", "right", "left", "video"].includes(item.image_type)
      )
      .map((item, index) => ({
        label: `View ${index + 1}`,
        url: item.image_url,
      }));
    const videoUrl = imageFor("video");
    const allGalleryViews = [...galleryViews, ...additionalImages];

    return {
      ...gemstone,
      main_image: front,
      back_view_image: imageFor("back"),
      right_view_image: imageFor("right"),
      left_view_image: imageFor("left"),
      video_url: videoUrl,
      image: front || allGalleryViews[0]?.url || null,
      images: allGalleryViews.map((view) => view.url),
      galleryViews: allGalleryViews,
      rotationFrames: ["Front", "Right", "Back", "Left"]
        .map((label) => galleryViews.find((view) => view.label === label)?.url)
        .filter(Boolean),
      videoUrl,
    };
  });
};

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
      await removeUploadedFiles(req);
      return res.status(400).json({
        success: false,
        message: "Gemstone name and category_id are required",
      });
    }

    // Verify category exists
    const [categories] = await db.query("SELECT id FROM categories WHERE id = ?", [category_id]);
    if (!categories || categories.length === 0) {
      await removeUploadedFiles(req);
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

    const connection = await db.getConnection();
    let result;
    try {
      await connection.beginTransaction();
      [result] = await connection.query(query, values);

      for (const mediaField of mediaFields) {
        const file = req.files?.[mediaField.field]?.[0];
        if (!file) continue;

        await connection.query(
          `INSERT INTO gemstone_images
           (gemstone_id, image_url, image_type, is_primary)
           VALUES (?, ?, ?, ?)`,
          [
            result.insertId,
            `/uploads/gemstones/${file.filename}`,
            mediaField.type,
            mediaField.primary ? 1 : 0,
          ]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return res.status(201).json({
      success: true,
      message: "Gemstone successfully added!",
      id: result.insertId,
      gemstone_id: gemId,
    });
  } catch (error) {
    await removeUploadedFiles(req);
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
    const treatment = req.query.treatment ?? req.query.treatment_status;
    let treatmentFilter = "";
    let queryValues = [];

    if (treatment !== undefined) {
      if (typeof treatment !== "string") {
        return res.status(400).json({
          success: false,
          message: "Treatment filter must be a single value.",
        });
      }
      const aliases = treatmentAliases[normalizeTreatment(treatment)];
      if (!aliases) {
        return res.status(400).json({
          success: false,
          message: "Unsupported treatment filter.",
        });
      }
      treatmentFilter = `WHERE LOWER(TRIM(COALESCE(g.treatment_status, ''))) IN (${aliases
        .map(() => "?")
        .join(", ")})`;
      queryValues = aliases;
    }

    const query = `
      SELECT g.*, c.name AS category_name 
      FROM gemstones g 
      LEFT JOIN categories c ON g.category_id = c.id
      ${treatmentFilter}
      ORDER BY g.id DESC
    `;
    const [rows] = await db.query(query, queryValues);
    const gemstonesWithMedia = await attachGemstoneMedia(rows);
    const data = gemstonesWithMedia.map((gemstone) => ({
      ...gemstone,
      stock: Number(gemstone.stock),
    }));

    return res.status(200).json({
      success: true,
      data,
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
      LEFT JOIN certificates cert
        ON cert.id = (
          SELECT c2.id
          FROM certificates c2
          WHERE c2.gemstone_id = g.id
          ORDER BY c2.created_at DESC, c2.id DESC
          LIMIT 1
        )
      WHERE g.id = ? OR g.gemstone_id = ?
    `;

    const [rows] = await db.query(query, [id, id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gemstone not found",
      });
    }

    const [gemstoneWithMedia] = await attachGemstoneMedia([rows[0]]);

    return res.status(200).json({
      success: true,
      data: gemstoneWithMedia,
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

// Get Low Stock Gemstones
exports.getLowStockGemstones = async (req, res) => {
  try {
    // Default low stock threshold
    const threshold = 3;

    const [rows] = await db.query(
      `SELECT
        g.id,
        g.gemstone_id,
        g.name,
        g.stock,
        g.price,
        g.status,
        c.name AS category_name
      FROM gemstones g
      LEFT JOIN categories c
        ON g.category_id = c.id
      WHERE g.stock <= ?
      ORDER BY g.stock ASC`,
      [threshold]
    );

    return res.status(200).json({
      success: true,
      message: "Low stock gemstones fetched successfully",
      threshold: threshold,
      count: rows.length,
      data: rows
    });

  } catch (error) {
    console.error("Get Low Stock Gemstones Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch low stock gemstones",
      error: error.message
    });
  }
};