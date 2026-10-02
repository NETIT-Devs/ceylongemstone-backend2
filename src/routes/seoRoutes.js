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

router.post("/", createSeoPage);

router.get("/", getSeoPages);

router.get("/active", getActiveSeoPages);

router.get("/slug/:slug", getSeoPageBySlug);

router.get("/:id", getSeoPageById);

router.put("/:id", updateSeoPage);

router.delete("/:id", deleteSeoPage);

module.exports = router;