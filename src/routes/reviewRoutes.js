const express = require("express");

const {
  createReview,
  getReviews,
  getAdminReviews,
  updateReviewStatus,
  deleteReview
} = require("../controllers/reviewController");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", verifyToken, createReview);
router.get("/admin", verifyToken, requireAdmin, getAdminReviews);
router.get("/", getReviews);
router.put("/:id/status", verifyToken, requireAdmin, updateReviewStatus);
router.delete("/:id", verifyToken, requireAdmin, deleteReview);

module.exports = router;