const db = require("../config/db");

// Add gemstone to cart
exports.addToCart = async (req, res) => {
  try {
    const { gemstone_id, quantity } = req.body;

// Get user ID from JWT token
const user_id = req.user.id;

if (!user_id || !gemstone_id) {
  return res.status(400).json({
    success: false,
    message: "gemstone_id is required"
  });
}

    const cartQuantity = quantity || 1;

    if (cartQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1"
      });
    }

    // Check gemstone exists and get stock
const [gemstones] = await db.query(
  "SELECT id, name, stock FROM gemstones WHERE id = ? OR gemstone_id = ?",
  [gemstone_id, gemstone_id]
);

    if (gemstones.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gemstone not found"
      });
    }

    const gemstoneDbId = gemstones[0].id;

    const availableStock = Number(gemstones[0].stock);

if (availableStock === 0) {
  return res.status(400).json({
    success: false,
    message: `Insufficient stock for ${gemstones[0].name}`,
    available_stock: 0,
    requested_quantity: Number(cartQuantity)
  });
}

if (Number(cartQuantity) > availableStock) {
  return res.status(400).json({
    success: false,
    message: `Insufficient stock for ${gemstones[0].name}`,
    available_stock: availableStock,
    requested_quantity: Number(cartQuantity)
  });
}

    // Check if gemstone already exists in cart
    const [existing] = await db.query(
      "SELECT id, quantity FROM cart WHERE user_id = ? AND gemstone_id = ?",
      [user_id, gemstoneDbId]
    );

    if (existing.length > 0) {
      const newQuantity = existing[0].quantity + Number(cartQuantity);
      
      if (newQuantity > availableStock) {
    return res.status(400).json({
      success: false,
      message: `Insufficient stock for ${gemstones[0].name}`,
      available_stock: availableStock,
      requested_quantity: newQuantity
    });
  }t       

      await db.query(
        "UPDATE cart SET quantity = ?, updated_at = NOW() WHERE id = ?",
        [newQuantity, existing[0].id]
      );

      return res.status(200).json({
        success: true,
        message: "Cart quantity updated successfully",
        cart_id: existing[0].id,
        quantity: newQuantity
      });
    }

    // Add new cart item
    const [result] = await db.query(
      `INSERT INTO cart 
       (user_id, gemstone_id, quantity, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [user_id, gemstoneDbId, cartQuantity]
    );

    return res.status(201).json({
      success: true,
      message: "Gemstone added to cart successfully",
      cart_id: result.insertId,
      quantity: cartQuantity
    });

  } catch (error) {
    console.error("Add Cart Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add gemstone to cart",
      error: error.message
    });
  }
};

// Get user cart
exports.getCart = async (req, res) => {
  try {
   // Get user ID from JWT token
const user_id = req.user.id;

    const [cart] = await db.query(
      `SELECT
        c.id,
        c.user_id,
        c.gemstone_id,
        g.gemstone_id AS gemstone_code,
        g.name,
        g.color,
        g.carat,
        g.price,
        c.quantity,
        (g.price * c.quantity) AS subtotal,
        gi.image_url,
        c.created_at,
        c.updated_at
      FROM cart c
      INNER JOIN gemstones g ON c.gemstone_id = g.id
      LEFT JOIN gemstone_images gi
        ON g.id = gi.gemstone_id
        AND gi.is_primary = 1
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC`,
      [user_id]
    );

    return res.status(200).json({
      success: true,
      data: cart
    });

  } catch (error) {
    console.error("Get Cart Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch cart",
      error: error.message
    });
  }
};

// Update cart quantity
exports.updateCart = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (!quantity || Number(quantity) < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1"
      });
    }

    // Check cart item and gemstone stock
    const user_id = req.user.id;

const [cartItem] = await db.query(
  `SELECT
    c.id,
    c.user_id,
    c.gemstone_id,
    g.name,
    g.stock
   FROM cart c
   INNER JOIN gemstones g ON c.gemstone_id = g.id
   WHERE c.id = ? AND c.user_id = ?`,
  [id, user_id]
);

    if (cartItem.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found"
      });
    }

    const availableStock = Number(cartItem[0].stock);
    const requestedQuantity = Number(quantity);

    // Check stock
    if (requestedQuantity > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${cartItem[0].name}`,
        available_stock: availableStock,
        requested_quantity: requestedQuantity
      });
    }

    await db.query(
      `UPDATE cart
       SET quantity = ?, updated_at = NOW()
       WHERE id = ?`,
      [requestedQuantity, id]
    );

    return res.status(200).json({
      success: true,
      message: "Cart quantity updated successfully",
      cart_id: Number(id),
      quantity: requestedQuantity
    });

  } catch (error) {
    console.error("Update Cart Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update cart quantity",
      error: error.message
    });
  }
};

// Remove item from cart
exports.deleteCart = async (req, res) => {
  try {
    const { id } = req.params;

    const user_id = req.user.id;

const [cartItem] = await db.query(
  "SELECT id FROM cart WHERE id = ? AND user_id = ?",
  [id, user_id]
);

    if (cartItem.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found"
      });
    }

    await db.query(
      "DELETE FROM cart WHERE id = ?",
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Cart item removed successfully"
    });

  } catch (error) {
    console.error("Delete Cart Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove cart item",
      error: error.message
    });
  }
};