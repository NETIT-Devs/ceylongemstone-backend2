const express = require("express");

const {
  createSeoPage,
  getSeoPages,
  getActiveSeoPages,
  getSeoPageById,
  getSeoPageBySlug,
  updateSeoPage,
  deleteSeoPage
} = require("../controllers/seoController");

const router = express.Router();

// Create an SEO page.
router.post("/", createSeoPage);

// List all SEO pages.
router.get("/", getSeoPages);

// List only active SEO pages.
router.get("/active", getActiveSeoPages);

// Find an SEO page by its URL slug.
router.get("/slug/:slug", getSeoPageBySlug);

// Find an SEO page by its database ID.
router.get("/:id", getSeoPageById);

// Update an SEO page by its database ID.
router.put("/:id", updateSeoPage);

// Delete an SEO page by its database ID.
router.delete("/:id", deleteSeoPage);

// Export the configured SEO routes.
module.exports = router;