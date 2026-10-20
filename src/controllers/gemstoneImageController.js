const db = require("../config/db");
const {
  removeUploadedFile,
  removeUploadedFileObjects,
} = require("../utils/uploadFileCleanup");

const removeUnreferencedGemstoneImage = async (imageUrl) => {
  if (!imageUrl) return;

  try {
    const [references] = await db.query(
      "SELECT id FROM gemstone_images WHERE image_url = ? LIMIT 1",
      [imageUrl]
    );
    if (references.length === 0) {
      await removeUploadedFile(imageUrl);
    }
  } catch (error) {
    console.error("Gemstone image reference check failed:", error);
  }
};

// Upload gemstone image
exports.uploadGemstoneImage = async (req, res) => {
  try {

    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    // Safely destructure body — supports both multipart/form-data (file) and JSON (image_url)
    const { gemstone_id, image_type, is_primary, image_url: bodyImageUrl } = req.body || {};

    console.log("GEMSTONE ID:", gemstone_id);

    // gemstone_id is the only required field
    if (!gemstone_id) {
      if (req.file) await removeUploadedFileObjects([req.file]);
      return res.status(400).json({
        success: false,
        message: "gemstone_id is required",
      });
    }

    // Check gemstone
    const [gemstones] = await db.query(
      "SELECT id FROM gemstones WHERE id = ? OR gemstone_id = ?",
      [gemstone_id, gemstone_id]
    );

    if (gemstones.length === 0) {
      if (req.file) await removeUploadedFileObjects([req.file]);
      return res.status(404).json({
        success: false,
        message: "Gemstone not found",
      });
    }

    const gemstoneDbId = gemstones[0].id;

    // Resolve image URL: uploaded file > body image_url > null (image is optional)
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/gemstones/${req.file.filename}`;
    } else if (bodyImageUrl) {
      imageUrl = bodyImageUrl;
    }

    const primaryValue =
      is_primary === true ||
      is_primary === "true" ||
      is_primary === 1 ||
      is_primary === "1"
        ? 1
        : 0;

    // If this image is primary, remove primary status from other images
    if (primaryValue === 1) {
      await db.query(
        "UPDATE gemstone_images SET is_primary = 0 WHERE gemstone_id = ?",
        [gemstoneDbId]
      );
    }

    const [result] = await db.query(
      `INSERT INTO gemstone_images
      (gemstone_id, image_url, image_type, is_primary)
      VALUES (?, ?, ?, ?)`,
      [
        gemstoneDbId,
        imageUrl,
        image_type || "gallery",
        primaryValue,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Gemstone image uploaded successfully",
      image_id: result.insertId,
      image_url: imageUrl,
    });

  } catch (error) {
    if (req.file) await removeUploadedFileObjects([req.file]);
    console.error("Upload Gemstone Image Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload gemstone image",
      error: error.message,
    });
  }
};

// Get all images of a gemstone
exports.getGemstoneImages = async (req, res) => {
  try {
    const { gemstone_id } = req.params;

    const [images] = await db.query(
      `SELECT 
        id,
        gemstone_id,
        image_url,
        image_type,
        is_primary,
        created_at
      FROM gemstone_images
      WHERE gemstone_id = ?
      ORDER BY is_primary DESC, id DESC`,
      [gemstone_id]
    );

    return res.status(200).json({
      success: true,
      data: images
    });

  } catch (error) {
    console.error("Get Gemstone Images Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get gemstone images",
      error: error.message
    });
  }
};

// Update gemstone image
exports.updateGemstoneImage = async (req, res) => {
  try {
    const { image_type, is_primary } = req.body;
    const { id } = req.params;

    // Check image
    const [images] = await db.query(
      "SELECT * FROM gemstone_images WHERE id = ?",
      [id]
    );

    if (images.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gemstone image not found",
      });
    }

    const gemstoneDbId = images[0].gemstone_id;

    const primaryValue =
      is_primary === true ||
      is_primary === "true" ||
      is_primary === 1 ||
      is_primary === "1"
        ? 1
        : 0;

    // If this image becomes primary
    if (primaryValue === 1) {
      await db.query(
        "UPDATE gemstone_images SET is_primary = 0 WHERE gemstone_id = ?",
        [gemstoneDbId]
      );
    }

    await db.query(
      `UPDATE gemstone_images
       SET image_type = ?, is_primary = ?
       WHERE id = ?`,
      [
        image_type || images[0].image_type,
        primaryValue,
        id
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Gemstone image updated successfully",
    });

  } catch (error) {
    console.error("Update Gemstone Image Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update gemstone image",
      error: error.message,
    });
  }
};

// Delete gemstone image
exports.deleteGemstoneImage = async (req, res) => {
  try {
    const { id } = req.params;

    // Check image
    const [images] = await db.query(
      "SELECT * FROM gemstone_images WHERE id = ?",
      [id]
    );

    if (images.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gemstone image not found",
      });
    }

    // Delete from database
    await db.query(
      "DELETE FROM gemstone_images WHERE id = ?",
      [id]
    );
    await removeUnreferencedGemstoneImage(images[0].image_url);

    return res.status(200).json({
      success: true,
      message: "Gemstone image deleted successfully",
    });

  } catch (error) {
    console.error("Delete Gemstone Image Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete gemstone image",
      error: error.message,
    });
  }
};