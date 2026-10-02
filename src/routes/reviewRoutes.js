const express = require("express");

const {
  createReview,
  getReviews,
  updateReviewStatus,
  deleteReview
} = require("../controllers/reviewController");

const router = express.Router();

router.post("/", createReview);
router.get("/", getReviews);
router.put("/:id/status", updateReviewStatus);
router.delete("/:id", deleteReview);

module.exports = router;