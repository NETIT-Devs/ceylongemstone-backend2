const db = require("../config/db");

// Add gemstone to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    // Get user_id from JWT token (set by verifyToken middleware)
    const user_id = req.user?.id;
    const { gemstone_id } = req.body;

    // Check required fields
    if (!user_id || !gemstone_id) {
      return res.status(400).json({
        success: false,
        message: "gemstone_id is required. user_id is taken from token."
      });
    }

    // Verify user exists in database
    const [users] = await db.query(
      "SELECT id FROM users WHERE id = ?",
      [user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check gemstone
    const [gemstones] = await db.query(
      "SELECT id FROM gemstones WHERE id = ? OR gemstone_id = ?",
      [gemstone_id, gemstone_id]
    );

    if (gemstones.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gemstone not found"
      });
    }

    const gemstoneDbId = gemstones[0].id;

    // Check already exists
    const [existing] = await db.query(
      "SELECT id FROM wishlists WHERE user_id = ? AND gemstone_id = ?",
      [user_id, gemstoneDbId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Gemstone already exists in wishlist"
      });
    }

    // Add wishlist
    const [result] = await db.query(
      `INSERT INTO wishlists (user_id, gemstone_id)
       VALUES (?, ?)`,
      [user_id, gemstoneDbId]
    );

    return res.status(201).json({
      success: true,
      message: "Gemstone added to wishlist successfully",
      wishlist_id: result.insertId
    });

  } catch (error) {
    console.error("Add Wishlist Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add gemstone to wishlist",
      error: error.message
    });
  }
};

// Get user wishlist
exports.getWishlist = async (req, res) => {
  try {
    const { user_id } = req.params;

    const [wishlist] = await db.query(
      `SELECT 
        w.id,
        w.user_id,
        w.gemstone_id,
        g.gemstone_id AS gemstone_code,
        g.name,
        g.color,
        g.carat,
        g.price,
        gi.image_url
      FROM wishlists w
      INNER JOIN gemstones g ON w.gemstone_id = g.id
      LEFT JOIN gemstone_images gi 
        ON g.id = gi.gemstone_id 
        AND gi.is_primary = 1
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC`,
      [user_id]
    );

    return res.status(200).json({
      success: true,
      data: wishlist
    });

  } catch (error) {
    console.error("Get Wishlist Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch wishlist",
      error: error.message
    });
  }
};

// Remove gemstone from wishlist
exports.deleteWishlist = async (req, res) => {
  try {
    const { id } = req.params;

    // Check wishlist exists
    const [wishlist] = await db.query(
      "SELECT id FROM wishlists WHERE id = ?",
      [id]
    );

    if (wishlist.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Wishlist item not found"
      });
    }

    // Delete wishlist item
    await db.query(
      "DELETE FROM wishlists WHERE id = ?",
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Gemstone removed from wishlist successfully"
    });

  } catch (error) {
    console.error("Delete Wishlist Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove gemstone from wishlist",
      error: error.message
    });
  }
};