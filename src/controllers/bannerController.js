const db = require("../config/db");
const { removeUploadedFile } = require("../utils/uploadFileCleanup");

// Remove a banner file only when no banner record still uses its URL.
const removeUnreferencedBannerMedia = async (mediaUrl) => {
  // Skip database and file-system work when no media URL was provided.
  if (!mediaUrl) return;

  try {
    // Check for references before deleting the uploaded file.
    const [references] = await db.query(
      "SELECT id FROM banners WHERE media_url = ? LIMIT 1",
      [mediaUrl]
    );
    if (references.length === 0) {
      await removeUploadedFile(mediaUrl);
    }
  } catch (error) {
    console.error("Banner media reference check failed:", error);
  }
};

// Create Banner
const createBanner = async (req, res) => {
  try {
    // Read the banner content and display settings from the request.
    const {
      title,
      badge,
      subtitle,
      button_text,
      button_link,
      link_url,
      secondary_button_text,
      secondary_button_link,
      media_type,
      media_url,
      sort_order,
      status
    } = req.body;

    // Support the legacy link_url field as a fallback for the primary button.
    const bannerButtonLink = button_link !== undefined ? button_link : link_url;

    // Require the core text and media details before creating a banner.
    if (!title || !media_type || !media_url) {
      return res.status(400).json({
        success: false,
        message: "title, media_type and media_url are required"
      });
    }

    const allowedTypes = ["IMAGE", "VIDEO"];

    // Restrict banner media to supported image and video types.
    if (!allowedTypes.includes(media_type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "media_type must be IMAGE or VIDEO"
      });
    }

    // Insert the banner using parameters to safely pass request values.
    const [result] = await db.query(
      `INSERT INTO banners
      (title, badge, subtitle, button_text, button_link, secondary_button_text,
       secondary_button_link, media_type, media_url, link_url, sort_order, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        badge || null,
        subtitle || null,
        button_text || null,
        bannerButtonLink || null,
        secondary_button_text || null,
        secondary_button_link || null,
        media_type.toUpperCase(),
        media_url,
        bannerButtonLink || null,
        sort_order || 0,
        status !== undefined ? status : 1
      ]
    );

    // Return the new banner's database ID.
    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      banner_id: result.insertId
    });

  } catch (error) {
    // Log the failure and return a server error response.
    console.error("Create Banner Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create banner",
      error: error.message
    });
  }
};


// Upload Banner Image / Video
const uploadBannerMedia = async (req, res) => {
  try {
    // Reject requests where the upload middleware did not provide a file.
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image or video file"
      });
    }

    // Build the public URL and classify the uploaded file by MIME type.
    const fileUrl = `/uploads/banners/${req.file.filename}`;

    const mediaType = req.file.mimetype.startsWith("video/")
      ? "VIDEO"
      : "IMAGE";

    // Return the media details needed when creating or updating a banner.
    res.status(201).json({
      success: true,
      message: "Banner media uploaded successfully",
      media_type: mediaType,
      media_url: fileUrl,
      file_name: req.file.filename
    });

  } catch (error) {
    // Log upload failures and return a server error response.
    console.error("Banner Upload Error:", error);

    res.status(500).json({
      success: false,
      message: "Banner media upload failed",
      error: error.message
    });
  }
};


// Get All Banners
const getBanners = async (req, res) => {
  try {
    // Fetch all banners in display order, including inactive banners.
    const [banners] = await db.query(
      `SELECT *
       FROM banners
       ORDER BY sort_order ASC, id DESC`
    );

    // Return the banner list and its total count.
    res.status(200).json({
      success: true,
      count: banners.length,
      banners
    });

  } catch (error) {
    // Log query failures and return a server error response.
    console.error("Get Banners Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
      error: error.message
    });
  }
};


// Get Single Banner
const getBannerById = async (req, res) => {
  try {
    // Read the requested banner ID from the route.
    const { id } = req.params;

    // Look up the banner by its database ID.
    const [banners] = await db.query(
      "SELECT * FROM banners WHERE id = ?",
      [id]
    );

    // Return 404 when no banner matches the requested ID.
    if (banners.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    // Return the matching banner record.
    res.status(200).json({
      success: true,
      banner: banners[0]
    });

  } catch (error) {
    // Log query failures and return a server error response.
    console.error("Get Banner Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch banner",
      error: error.message
    });
  }
};


// Update Banner
const updateBanner = async (req, res) => {
  try {
    // Read the target ID and any banner fields supplied for update.
    const { id } = req.params;

    const {
      title,
      badge,
      subtitle,
      button_text,
      button_link,
      link_url,
      secondary_button_text,
      secondary_button_link,
      media_type,
      media_url,
      sort_order,
      status
    } = req.body;

    // Support the legacy link_url field as a fallback for the primary button.
    const bannerButtonLink = button_link !== undefined ? button_link : link_url;

    // Load the existing media URL so it can be cleaned up if replaced.
    const [existing] = await db.query(
      "SELECT id, media_url FROM banners WHERE id = ?",
      [id]
    );

    // Return 404 before attempting to update a missing banner.
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    // Validate the media type when the request includes one.
    if (media_type) {
      const allowedTypes = ["IMAGE", "VIDEO"];

      if (!allowedTypes.includes(media_type.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: "media_type must be IMAGE or VIDEO"
        });
      }
    }

    // Update supplied fields while retaining existing values for omitted fields.
    await db.query(
      `UPDATE banners
       SET
         title = COALESCE(?, title),
         badge = COALESCE(?, badge),
         subtitle = COALESCE(?, subtitle),
         button_text = COALESCE(?, button_text),
         button_link = COALESCE(?, button_link),
         secondary_button_text = COALESCE(?, secondary_button_text),
         secondary_button_link = COALESCE(?, secondary_button_link),
         media_type = COALESCE(?, media_type),
         media_url = COALESCE(?, media_url),
         link_url = COALESCE(?, link_url),
         sort_order = COALESCE(?, sort_order),
         status = COALESCE(?, status)
       WHERE id = ?`,
      [
        title || null,
        badge !== undefined ? badge : null,
        subtitle !== undefined ? subtitle : null,
        button_text !== undefined ? button_text : null,
        bannerButtonLink !== undefined ? bannerButtonLink : null,
        secondary_button_text !== undefined ? secondary_button_text : null,
        secondary_button_link !== undefined ? secondary_button_link : null,
        media_type ? media_type.toUpperCase() : null,
        media_url || null,
        bannerButtonLink !== undefined ? bannerButtonLink : null,
        sort_order !== undefined ? sort_order : null,
        status !== undefined ? status : null,
        id
      ]
    );

    // Remove the old file only after its URL has been replaced.
    const updatedMediaUrl = media_url || existing[0].media_url;
    if (updatedMediaUrl !== existing[0].media_url) {
      await removeUnreferencedBannerMedia(existing[0].media_url);
    }

    // Confirm that the banner was updated successfully.
    res.status(200).json({
      success: true,
      message: "Banner updated successfully"
    });

  } catch (error) {
    // Log update failures and return a server error response.
    console.error("Update Banner Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update banner",
      error: error.message
    });
  }
};


// Delete Banner
const deleteBanner = async (req, res) => {
  try {
    // Read the target ID and retrieve its media URL before deleting the record.
    const { id } = req.params;

    const [existing] = await db.query(
      "SELECT media_url FROM banners WHERE id = ?",
      [id]
    );

    // Return 404 when the banner does not exist.
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    // Delete the banner record from the database.
    const [result] = await db.query(
      "DELETE FROM banners WHERE id = ?",
      [id]
    );

    // Handle a banner that disappeared before the delete completed.
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    // Remove the media file only if no other banner references it.
    await removeUnreferencedBannerMedia(existing[0].media_url);

    // Confirm that the banner was deleted.
    res.status(200).json({
      success: true,
      message: "Banner deleted successfully"
    });

  } catch (error) {
    // Log deletion failures and return a server error response.
    console.error("Delete Banner Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete banner",
      error: error.message
    });
  }
};

const getActiveBanners = async (req, res) => {
  try {
    // Fetch only active banners and resolve the primary button link fallback.
    const [banners] = await db.query(
      `SELECT id, title, badge, subtitle, button_text,
              COALESCE(NULLIF(button_link, ''), link_url) AS button_link,
              secondary_button_text, secondary_button_link,
              media_type, media_url, sort_order, status, created_at, updated_at
       FROM banners
       WHERE status = 1
       ORDER BY sort_order ASC, id DESC`
    );

    // Return the active banners and their total count.
    res.status(200).json({
      success: true,
      count: banners.length,
      banners
    });

  } catch (error) {
    // Log query failures and return a server error response.
    console.error("Get Active Banners Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch active banners",
      error: error.message
    });
  }
};

// Export the handlers used by the banner routes.
module.exports = {
  createBanner,
  uploadBannerMedia,
  getBanners,
  getActiveBanners,
  getBannerById,
  updateBanner,
  deleteBanner
};