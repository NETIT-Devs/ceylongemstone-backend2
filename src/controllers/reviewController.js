const db = require("../config/db");

// Create Review
exports.createReview = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    const { gemstone_id, rating, comment } = req.body;
    const numericRating = Number(rating);
    const reviewComment = typeof comment === "string" ? comment.trim() : "";

    if (!Number.isSafeInteger(userId) || userId < 1 || !reviewComment) {
      return res.status(400).json({
        success: false,
        message: "A valid authenticated user and review comment are required"
      });
    }

    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be a whole number between 1 and 5"
      });
    }

    const [users] = await db.query(
      "SELECT id FROM users WHERE id = ? AND status = 1",
      [userId]
    );
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Your account is unavailable. Please log in again."
      });
    }

    let gemstoneDbId = null;
    if (gemstone_id !== undefined && gemstone_id !== null && gemstone_id !== "") {
      const gemstoneReference = String(gemstone_id).trim();
      const [gemstone] = await db.query(
        "SELECT id FROM gemstones WHERE id = ? OR gemstone_id = ?",
        [gemstoneReference, gemstoneReference]
      );

      if (gemstone.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Gemstone not found"
        });
      }
      gemstoneDbId = gemstone[0].id;
    }

    const [result] = await db.query(
      `INSERT INTO reviews
       (user_id, gemstone_id, rating, comment, status, created_at)
       VALUES (?, ?, ?, ?, 'PENDING', NOW())`,
      [
        userId,
        gemstoneDbId,
        numericRating,
        reviewComment
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

// Public reviews only include content approved for display.
exports.getReviews = async (req, res) => {
  try {
    const [reviews] = await db.query(
      `SELECT
        r.id,
        r.user_id,
        u.name AS name,
        u.email AS email,
        r.gemstone_id,
        g.gemstone_id AS gemstone_code,
        g.name AS gemstone_name,
        r.rating,
        r.comment,
        r.status,
        r.created_at
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN gemstones g ON r.gemstone_id = g.id
      WHERE r.status = 'APPROVED'
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

exports.getAdminReviews = async (req, res) => {
  try {
    const [reviews] = await db.query(
      `SELECT
        r.id,
        r.user_id,
        u.name AS name,
        u.email AS email,
        r.gemstone_id,
        g.gemstone_id AS gemstone_code,
        g.name AS gemstone_name,
        r.rating,
        r.comment,
        r.status,
        r.created_at
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN gemstones g ON r.gemstone_id = g.id
      ORDER BY r.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      data: reviews
    });
  } catch (error) {
    console.error("Get Admin Reviews Error:", error);
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

    const reviewId = Number(id);
    if (!Number.isSafeInteger(reviewId) || reviewId < 1) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    const [result] = await db.query(
      "DELETE FROM reviews WHERE id = ?",
      [reviewId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      review_id: reviewId
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