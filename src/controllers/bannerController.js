const db = require("../config/db");
const { removeUploadedFile } = require("../utils/uploadFileCleanup");

const removeUnreferencedBannerMedia = async (mediaUrl) => {
  if (!mediaUrl) return;

  try {
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
    const {
      title,
      media_type,
      media_url,
      link_url,
      sort_order,
      status
    } = req.body;

    if (!title || !media_type || !media_url) {
      return res.status(400).json({
        success: false,
        message: "title, media_type and media_url are required"
      });
    }

    const allowedTypes = ["IMAGE", "VIDEO"];

    if (!allowedTypes.includes(media_type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "media_type must be IMAGE or VIDEO"
      });
    }

    const [result] = await db.query(
      `INSERT INTO banners
      (title, media_type, media_url, link_url, sort_order, status)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        title,
        media_type.toUpperCase(),
        media_url,
        link_url || null,
        sort_order || 0,
        status !== undefined ? status : 1
      ]
    );

    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      banner_id: result.insertId
    });

  } catch (error) {
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
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image or video file"
      });
    }

    const fileUrl = `/uploads/banners/${req.file.filename}`;

    const mediaType = req.file.mimetype.startsWith("video/")
      ? "VIDEO"
      : "IMAGE";

    res.status(201).json({
      success: true,
      message: "Banner media uploaded successfully",
      media_type: mediaType,
      media_url: fileUrl,
      file_name: req.file.filename
    });

  } catch (error) {
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
    const [banners] = await db.query(
      `SELECT *
       FROM banners
       ORDER BY sort_order ASC, id DESC`
    );

    res.status(200).json({
      success: true,
      count: banners.length,
      banners
    });

  } catch (error) {
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
    const { id } = req.params;

    const [banners] = await db.query(
      "SELECT * FROM banners WHERE id = ?",
      [id]
    );

    if (banners.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    res.status(200).json({
      success: true,
      banner: banners[0]
    });

  } catch (error) {
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
    const { id } = req.params;

    const {
      title,
      media_type,
      media_url,
      link_url,
      sort_order,
      status
    } = req.body;

    const [existing] = await db.query(
      "SELECT id, media_url FROM banners WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    if (media_type) {
      const allowedTypes = ["IMAGE", "VIDEO"];

      if (!allowedTypes.includes(media_type.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: "media_type must be IMAGE or VIDEO"
        });
      }
    }

    await db.query(
      `UPDATE banners
       SET
         title = COALESCE(?, title),
         media_type = COALESCE(?, media_type),
         media_url = COALESCE(?, media_url),
         link_url = COALESCE(?, link_url),
         sort_order = COALESCE(?, sort_order),
         status = COALESCE(?, status)
       WHERE id = ?`,
      [
        title || null,
        media_type ? media_type.toUpperCase() : null,
        media_url || null,
        link_url || null,
        sort_order !== undefined ? sort_order : null,
        status !== undefined ? status : null,
        id
      ]
    );

    const updatedMediaUrl = media_url || existing[0].media_url;
    if (updatedMediaUrl !== existing[0].media_url) {
      await removeUnreferencedBannerMedia(existing[0].media_url);
    }

    res.status(200).json({
      success: true,
      message: "Banner updated successfully"
    });

  } catch (error) {
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
    const { id } = req.params;

    const [existing] = await db.query(
      "SELECT media_url FROM banners WHERE id = ?",
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    const [result] = await db.query(
      "DELETE FROM banners WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    await removeUnreferencedBannerMedia(existing[0].media_url);

    res.status(200).json({
      success: true,
      message: "Banner deleted successfully"
    });

  } catch (error) {
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
    const [banners] = await db.query(
      `SELECT *
       FROM banners
       WHERE status = 1
       ORDER BY sort_order ASC, id DESC`
    );

    res.status(200).json({
      success: true,
      count: banners.length,
      banners
    });

  } catch (error) {
    console.error("Get Active Banners Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch active banners",
      error: error.message
    });
  }
};

module.exports = {
  createBanner,
  uploadBannerMedia,
  getBanners,
  getActiveBanners,
  getBannerById,
  updateBanner,
  deleteBanner
};