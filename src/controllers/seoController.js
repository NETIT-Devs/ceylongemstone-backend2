const db = require("../config/db");

// Create SEO Page
const createSeoPage = async (req, res) => {
  try {
    // Read the page identity, SEO metadata, and activation status.
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

    // Require the page name and slug before creating a record.
    if (!page_name || !page_slug) {
      return res.status(400).json({
        success: false,
        message: "page_name and page_slug are required"
      });
    }

    // Prevent multiple SEO pages from using the same slug.
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

    // Insert the SEO page, storing omitted optional metadata as null.
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

    // Return the new SEO page ID.
    res.status(201).json({
      success: true,
      message: "SEO page created successfully",
      seo_id: result.insertId
    });

  } catch (error) {
    // Log database failures and return an explicit server error.
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
    // Fetch every SEO page, with the newest records first.
    const [pages] = await db.query(
      `SELECT *
       FROM seo_pages
       ORDER BY created_at DESC`
    );

    // Return the page list and its total count.
    res.status(200).json({
      success: true,
      count: pages.length,
      pages
    });

  } catch (error) {
    // Log query failures and return an explicit server error.
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
    // Fetch only active SEO pages, with the newest records first.
    const [pages] = await db.query(
      `SELECT *
       FROM seo_pages
       WHERE status = 1
       ORDER BY created_at DESC`
    );

    // Return the active page list and its total count.
    res.status(200).json({
      success: true,
      count: pages.length,
      pages
    });

  } catch (error) {
    // Log query failures and return an explicit server error.
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
    // Read the requested SEO page ID from the route.
    const { id } = req.params;

    // Look up the page by its database ID.
    const [pages] = await db.query(
      "SELECT * FROM seo_pages WHERE id = ?",
      [id]
    );

    // Return 404 when no page matches the requested ID.
    if (pages.length === 0) {
      return res.status(404).json({
        success: false,
        message: "SEO page not found"
      });
    }

    // Return the matching SEO page.
    res.status(200).json({
      success: true,
      page: pages[0]
    });

  } catch (error) {
    // Log query failures and return an explicit server error.
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
    // Read the requested page slug from the route.
    const { slug } = req.params;

    // Look up the SEO page by its URL slug.
    const [pages] = await db.query(
      "SELECT * FROM seo_pages WHERE page_slug = ?",
      [slug]
    );

    // Return 404 when no page matches the requested slug.
    if (pages.length === 0) {
      return res.status(404).json({
        success: false,
        message: "SEO page not found"
      });
    }

    // Return the matching SEO page.
    res.status(200).json({
      success: true,
      page: pages[0]
    });

  } catch (error) {
    // Log query failures and return an explicit server error.
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
    // Read the target ID and any SEO fields supplied for update.
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

    // Confirm the page exists before attempting to update it.
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

    // Ensure a changed slug is not already assigned to another page.
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

    // Update supplied metadata while retaining existing values for omitted fields.
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

    // Confirm that the SEO page was updated.
    res.status(200).json({
      success: true,
      message: "SEO page updated successfully"
    });

  } catch (error) {
    // Log database failures and return an explicit server error.
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
    // Read the target SEO page ID from the route.
    const { id } = req.params;

    // Delete the matching page record.
    const [result] = await db.query(
      "DELETE FROM seo_pages WHERE id = ?",
      [id]
    );

    // Return 404 when the ID did not match a page.
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "SEO page not found"
      });
    }

    // Confirm that the SEO page was deleted.
    res.status(200).json({
      success: true,
      message: "SEO page deleted successfully"
    });

  } catch (error) {
    // Log database failures and return an explicit server error.
    console.error("Delete SEO Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete SEO page",
      error: error.message
    });
  }
};

// Export the handlers used by the SEO routes.
module.exports = {
  createSeoPage,
  getSeoPages,
  getActiveSeoPages,
  getSeoPageById,
  getSeoPageBySlug,
  updateSeoPage,
  deleteSeoPage
};