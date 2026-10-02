const express = require("express");

const {
  createBlog,
  getBlogs,
  getPublishedBlogs,
  getBlogById,
  getBlogBySlug,
  updateBlog,
  deleteBlog
} = require("../controllers/blogController");

const router = express.Router();

// Create Blog
router.post("/", createBlog);

// Get All Blogs
router.get("/", getBlogs);

// Get Published Blogs
router.get("/published", getPublishedBlogs);

// Get Blog by Slug
router.get("/slug/:slug", getBlogBySlug);

// Get Single Blog
router.get("/:id", getBlogById);

// Update Blog
router.put("/:id", updateBlog);

// Delete Blog
router.delete("/:id", deleteBlog);

module.exports = router;