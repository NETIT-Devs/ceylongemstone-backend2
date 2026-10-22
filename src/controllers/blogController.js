const db = require("../config/db");
const { removeUploadedFileObjects } = require("../utils/uploadFileCleanup");

// Create Blog
const createBlog = async (req, res) => {
  try {
    const {
      title,
      category,
      summary,
      content,
    } = req.body;
    const normalizedTitle = typeof title === "string" ? title.trim() : "";
    const normalizedCategory = typeof category === "string" ? category.trim() : "";
    const normalizedSummary = typeof summary === "string" ? summary.trim() : "";
    const normalizedContent = typeof content === "string" ? content.trim() : "";

    if (!normalizedTitle || !normalizedCategory || !normalizedSummary || !normalizedContent || !req.file) {
      if (req.file) await removeUploadedFileObjects([req.file]);
      return res.status(400).json({
        success: false,
        message: "title, category, summary, content, and image are required"
      });
    }

    const image = `/uploads/blogs/${req.file.filename}`;

    const [result] = await db.query(
      `INSERT INTO blogs
      (title, category, summary, content, image, author_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        normalizedTitle,
        normalizedCategory,
        normalizedSummary,
        normalizedContent,
        image,
        req.user?.id || null,
        1
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Blog created successfully",
      blog_id: result.insertId,
      image
    });

  } catch (error) {
    if (req.file) await removeUploadedFileObjects([req.file]);
    console.error("Create Blog Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create blog",
      error: error.message
    });
  }
};


// Get All Blogs
const getBlogs = async (req, res) => {
  try {
    const [blogs] = await db.query(
      `SELECT *
       FROM blogs
       ORDER BY created_at DESC`
    );

    res.status(200).json({
      success: true,
      count: blogs.length,
      blogs
    });

  } catch (error) {
    console.error("Get Blogs Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch blogs",
      error: error.message
    });
  }
};


// Get Published Blogs
const getPublishedBlogs = async (req, res) => {
  try {
    const [blogs] = await db.query(
      `SELECT *
       FROM blogs
       WHERE status = 1
       ORDER BY created_at DESC`
    );

    res.status(200).json({
      success: true,
      count: blogs.length,
      blogs
    });

  } catch (error) {
    console.error("Get Published Blogs Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch published blogs",
      error: error.message
    });
  }
};


// Get Single Blog
const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;

    const [blogs] = await db.query(
      "SELECT * FROM blogs WHERE id = ?",
      [id]
    );

    if (blogs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

    res.status(200).json({
      success: true,
      blog: blogs[0]
    });

  } catch (error) {
    console.error("Get Blog Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch blog",
      error: error.message
    });
  }
};


// Get Blog by Slug
const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const [blogs] = await db.query(
      "SELECT * FROM blogs WHERE slug = ?",
      [slug]
    );

    if (blogs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

    res.status(200).json({
      success: true,
      blog: blogs[0]
    });

  } catch (error) {
    console.error("Get Blog By Slug Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch blog",
      error: error.message
    });
  }
};


// Update Blog
const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      slug,
      content,
      image,
      author_id,
      status
    } = req.body;

    const [existing] = await db.query(
      "SELECT id FROM blogs WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

    if (slug) {
      const [slugCheck] = await db.query(
        "SELECT id FROM blogs WHERE slug = ? AND id != ?",
        [slug, id]
      );

      if (slugCheck.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Blog slug already exists"
        });
      }
    }

    await db.query(
      `UPDATE blogs
       SET
         title = COALESCE(?, title),
         slug = COALESCE(?, slug),
         content = COALESCE(?, content),
         image = COALESCE(?, image),
         author_id = COALESCE(?, author_id),
         status = COALESCE(?, status)
       WHERE id = ?`,
      [
        title || null,
        slug || null,
        content || null,
        image || null,
        author_id !== undefined ? author_id : null,
        status || null,
        id
      ]
    );

    res.status(200).json({
      success: true,
      message: "Blog updated successfully"
    });

  } catch (error) {
    console.error("Update Blog Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update blog",
      error: error.message
    });
  }
};


// Delete Blog
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      "DELETE FROM blogs WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Blog not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully"
    });

  } catch (error) {
    console.error("Delete Blog Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete blog",
      error: error.message
    });
  }
};


module.exports = {
  createBlog,
  getBlogs,
  getPublishedBlogs,
  getBlogById,
  getBlogBySlug,
  updateBlog,
  deleteBlog
};