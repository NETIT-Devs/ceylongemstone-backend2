const db = require("../config/db");

// Create Review
exports.createReview = async (req, res) => {
  try {
    const {
      user_id,
      gemstone_id,
      rating,
      comment
    } = req.body;

    if (!user_id || !gemstone_id || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: "user_id, gemstone_id, rating and comment are required"
      });
    }

    // Validate rating
    if (Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5"
      });
    }

    // Check gemstone exists
    const [gemstone] = await db.query(
      "SELECT id FROM gemstones WHERE id = ? OR gemstone_id = ?",
      [gemstone_id, gemstone_id]
    );

    if (gemstone.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gemstone not found"
      });
    }

    const gemstoneDbId = gemstone[0].id;

    const [result] = await db.query(
      `INSERT INTO reviews
       (user_id, gemstone_id, rating, comment, status, created_at)
       VALUES (?, ?, ?, ?, 'PENDING', NOW())`,
      [
        user_id,
        gemstoneDbId,
        Number(rating),
        comment
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review_id: result.insertId
    });

  } catch (error) {
    console.error("Create Review Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit review",
      error: error.message
    });
  }
};

// Get all reviews
exports.getReviews = async (req, res) => {
  try {
    const [reviews] = await db.query(
      `SELECT
        r.id,
        r.user_id,
        r.gemstone_id,
        g.gemstone_id AS gemstone_code,
        g.name AS gemstone_name,
        r.rating,
        r.comment,
        r.status,
        r.created_at
      FROM reviews r
      INNER JOIN gemstones g ON r.gemstone_id = g.id
      ORDER BY r.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      data: reviews
    });

  } catch (error) {
    console.error("Get Reviews Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
      error: error.message
    });
  }
};

// Update Review Status
exports.updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["PENDING", "APPROVED", "REJECTED"];

    if (!status || !allowedStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Status must be PENDING, APPROVED or REJECTED"
      });
    }

    const [review] = await db.query(
      "SELECT id FROM reviews WHERE id = ?",
      [id]
    );

    if (review.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    const updatedStatus = status.toUpperCase();

    await db.query(
      "UPDATE reviews SET status = ? WHERE id = ?",
      [updatedStatus, id]
    );

    return res.status(200).json({
      success: true,
      message: "Review status updated successfully",
      review_id: Number(id),
      status: updatedStatus
    });

  } catch (error) {
    console.error("Update Review Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update review status",
      error: error.message
    });
  }
};

// Delete Review
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    const [review] = await db.query(
      "SELECT id FROM reviews WHERE id = ?",
      [id]
    );

    if (review.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    await db.query(
      "DELETE FROM reviews WHERE id = ?",
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully"
    });

  } catch (error) {
    console.error("Delete Review Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete review",
      error: error.message
    });
  }
};