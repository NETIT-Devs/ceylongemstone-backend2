const db = require("../config/db");

// Create SEO Page
const createSeoPage = async (req, res) => {
  try {
    const {
      page_name,
      page_slug,
      seo_title,
      meta_description,
      meta_keywords,
      og_title,
      og_description,
      canonical_url,
      status
    } = req.body;

    if (!page_name || !page_slug) {
      return res.status(400).json({
        success: false,
        message: "page_name and page_slug are required"
      });
    }

    const [existing] = await db.query(
      "SELECT id FROM seo_pages WHERE page_slug = ?",
      [page_slug]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Page slug already exists"
      });
    }

    const [result] = await db.query(
      `INSERT INTO seo_pages
      (
        page_name,
        page_slug,
        seo_title,
        meta_description,
        meta_keywords,
        og_title,
        og_description,
        canonical_url,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        page_name,
        page_slug,
        seo_title || null,
        meta_description || null,
        meta_keywords || null,
        og_title || null,
        og_description || null,
        canonical_url || null,
        status !== undefined ? status : 1
      ]
    );

    res.status(201).json({
      success: true,
      message: "SEO page created successfully",
      seo_id: result.insertId
    });

  } catch (error) {
    console.error("Create SEO Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create SEO page",
      error: error.message
    });
  }
};


// Get All SEO Pages
const getSeoPages = async (req, res) => {
  try {
    const [pages] = await db.query(
      `SELECT *
       FROM seo_pages
       ORDER BY created_at DESC`
    );

    res.status(200).json({
      success: true,
      count: pages.length,
      pages
    });

  } catch (error) {
    console.error("Get SEO Pages Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch SEO pages",
      error: error.message
    });
  }
};


// Get Active SEO Pages
const getActiveSeoPages = async (req, res) => {
  try {
    const [pages] = await db.query(
      `SELECT *
       FROM seo_pages
       WHERE status = 1
       ORDER BY created_at DESC`
    );

    res.status(200).json({
      success: true,
      count: pages.length,
      pages
    });

  } catch (error) {
    console.error("Get Active SEO Pages Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch active SEO pages",
      error: error.message
    });
  }
};


// Get SEO Page by ID
const getSeoPageById = async (req, res) => {
  try {
    const { id } = req.params;

    const [pages] = await db.query(
      "SELECT * FROM seo_pages WHERE id = ?",
      [id]
    );

    if (pages.length === 0) {
      return res.status(404).json({
        success: false,
        message: "SEO page not found"
      });
    }

    res.status(200).json({
      success: true,
      page: pages[0]
    });

  } catch (error) {
    console.error("Get SEO Page Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch SEO page",
      error: error.message
    });
  }
};


// Get SEO Page by Slug
const getSeoPageBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const [pages] = await db.query(
      "SELECT * FROM seo_pages WHERE page_slug = ?",
      [slug]
    );

    if (pages.length === 0) {
      return res.status(404).json({
        success: false,
        message: "SEO page not found"
      });
    }

    res.status(200).json({
      success: true,
      page: pages[0]
    });

  } catch (error) {
    console.error("Get SEO Page By Slug Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch SEO page",
      error: error.message
    });
  }
};


// Update SEO Page
const updateSeoPage = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      page_name,
      page_slug,
      seo_title,
      meta_description,
      meta_keywords,
      og_title,
      og_description,
      canonical_url,
      status
    } = req.body;

    const [existing] = await db.query(
      "SELECT id FROM seo_pages WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "SEO page not found"
      });
    }

    if (page_slug) {
      const [slugCheck] = await db.query(
        "SELECT id FROM seo_pages WHERE page_slug = ? AND id != ?",
        [page_slug, id]
      );

      if (slugCheck.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Page slug already exists"
        });
      }
    }

    await db.query(
      `UPDATE seo_pages
       SET
         page_name = COALESCE(?, page_name),
         page_slug = COALESCE(?, page_slug),
         seo_title = COALESCE(?, seo_title),
         meta_description = COALESCE(?, meta_description),
         meta_keywords = COALESCE(?, meta_keywords),
         og_title = COALESCE(?, og_title),
         og_description = COALESCE(?, og_description),
         canonical_url = COALESCE(?, canonical_url),
         status = COALESCE(?, status)
       WHERE id = ?`,
      [
        page_name || null,
        page_slug || null,
        seo_title || null,
        meta_description || null,
        meta_keywords || null,
        og_title || null,
        og_description || null,
        canonical_url || null,
        status !== undefined ? status : null,
        id
      ]
    );

    res.status(200).json({
      success: true,
      message: "SEO page updated successfully"
    });

  } catch (error) {
    console.error("Update SEO Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update SEO page",
      error: error.message
    });
  }
};


// Delete SEO Page
const deleteSeoPage = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      "DELETE FROM seo_pages WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "SEO page not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "SEO page deleted successfully"
    });

  } catch (error) {
    console.error("Delete SEO Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete SEO page",
      error: error.message
    });
  }
};


module.exports = {
  createSeoPage,
  getSeoPages,
  getActiveSeoPages,
  getSeoPageById,
  getSeoPageBySlug,
  updateSeoPage,
  deleteSeoPage
};