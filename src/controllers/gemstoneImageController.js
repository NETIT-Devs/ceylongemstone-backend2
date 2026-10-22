const db = require("../config/db");
const {
  removeUploadedFile,
  removeUploadedFileObjects,
} = require("../utils/uploadFileCleanup");

// Delete an uploaded image only when no database record still references it.
const removeUnreferencedGemstoneImage = async (imageUrl) => {
  // Skip the reference lookup when there is no image URL.
  if (!imageUrl) return;

  try {
    // Check whether another gemstone image record uses this file.
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
    // Log the parsed request and uploaded file to help diagnose upload issues.
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    // Read image details from either multipart form data or a JSON request.
    const { gemstone_id, image_type, is_primary, image_url: bodyImageUrl } = req.body || {};

    console.log("GEMSTONE ID:", gemstone_id);

    // Require a gemstone identifier and clean up an uploaded file on rejection.
    if (!gemstone_id) {
      if (req.file) await removeUploadedFileObjects([req.file]);
      return res.status(400).json({
        success: false,
        message: "gemstone_id is required",
      });
    }

    // Resolve either the database ID or public gemstone ID to a database record.
    const [gemstones] = await db.query(
      "SELECT id FROM gemstones WHERE id = ? OR gemstone_id = ?",
      [gemstone_id, gemstone_id]
    );

    // Reject unknown gemstones and remove any file uploaded with the request.
    if (gemstones.length === 0) {
      if (req.file) await removeUploadedFileObjects([req.file]);
      return res.status(404).json({
        success: false,
        message: "Gemstone not found",
      });
    }

    const gemstoneDbId = gemstones[0].id;

    // Prefer the uploaded file URL, then the URL supplied in the request body.
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/gemstones/${req.file.filename}`;
    } else if (bodyImageUrl) {
      imageUrl = bodyImageUrl;
    }

    // Normalize supported boolean and string values for the primary-image flag.
    const primaryValue =
      is_primary === true ||
      is_primary === "true" ||
      is_primary === 1 ||
      is_primary === "1"
        ? 1
        : 0;

    // Clear the existing primary flag so this gemstone has a single primary image.
    if (primaryValue === 1) {
      await db.query(
        "UPDATE gemstone_images SET is_primary = 0 WHERE gemstone_id = ?",
        [gemstoneDbId]
      );
    }

    // Save the image metadata and its resolved URL.
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

    // Return the new image record ID and URL.
    return res.status(201).json({
      success: true,
      message: "Gemstone image uploaded successfully",
      image_id: result.insertId,
      image_url: imageUrl,
    });

  } catch (error) {
    // Remove the newly uploaded file if saving the image record fails.
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
    // Read the gemstone ID whose image gallery is requested.
    const { gemstone_id } = req.params;

    // Fetch the gemstone's images with primary images listed first.
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

    // Return the matching image records.
    return res.status(200).json({
      success: true,
      data: images
    });

  } catch (error) {
    // Log query failures and return a server error response.
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
    // Read the requested image changes and target image ID.
    const { image_type, is_primary } = req.body;
    const { id } = req.params;

    // Load the image record to confirm it exists and find its gemstone.
    const [images] = await db.query(
      "SELECT * FROM gemstone_images WHERE id = ?",
      [id]
    );

    // Return 404 when the image ID does not match a record.
    if (images.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gemstone image not found",
      });
    }

    const gemstoneDbId = images[0].gemstone_id;

    // Normalize supported boolean and string values for the primary-image flag.
    const primaryValue =
      is_primary === true ||
      is_primary === "true" ||
      is_primary === 1 ||
      is_primary === "1"
        ? 1
        : 0;

    // Clear the current primary flag before assigning it to this image.
    if (primaryValue === 1) {
      await db.query(
        "UPDATE gemstone_images SET is_primary = 0 WHERE gemstone_id = ?",
        [gemstoneDbId]
      );
    }

    // Update the image type and primary flag, preserving the current type if omitted.
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

    // Confirm that the image record was updated.
    return res.status(200).json({
      success: true,
      message: "Gemstone image updated successfully",
    });

  } catch (error) {
    // Log update failures and return a server error response.
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
    // Read the target image ID from the route.
    const { id } = req.params;

    // Load the image record so its URL can be cleaned up after deletion.
    const [images] = await db.query(
      "SELECT * FROM gemstone_images WHERE id = ?",
      [id]
    );

    // Return 404 when the image ID does not match a record.
    if (images.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gemstone image not found",
      });
    }

    // Remove the database record, then delete the file if it is no longer referenced.
    await db.query(
      "DELETE FROM gemstone_images WHERE id = ?",
      [id]
    );
    await removeUnreferencedGemstoneImage(images[0].image_url);

    // Confirm that the image record was deleted.
    return res.status(200).json({
      success: true,
      message: "Gemstone image deleted successfully",
    });

  } catch (error) {
    // Log deletion failures and return a server error response.
    console.error("Delete Gemstone Image Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete gemstone image",
      error: error.message,
    });
  }
};