const db = require("../config/db");

const getCartItemType = ({ gemstone_id, jewellery_id }) => {
  if (gemstone_id != null && jewellery_id == null) return "gemstone";
  if (jewellery_id != null && gemstone_id == null) return "jewellery";
  return null;
};

// Add a gemstone or jewellery item to the authenticated user's cart.
exports.addToCart = async (req, res) => {
  try {
    const {
      gemstone_id,
      jewellery_id,
      quantity = 1,
      replace_quantity = false
    } = req.body;
    const itemType = getCartItemType({ gemstone_id, jewellery_id });
    const itemId = itemType === "jewellery" ? jewellery_id : gemstone_id;
    const user_id = req.user.id;
    const cartQuantity = Number(quantity);

    if (!itemType || !Number.isSafeInteger(Number(itemId)) || Number(itemId) < 1) {
      return res.status(400).json({
        success: false,
        message: "Provide exactly one valid gemstone_id or jewellery_id"
      });
    }

    if (!Number.isSafeInteger(cartQuantity) || cartQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer"
      });
    }

    const table = itemType === "jewellery" ? "jewellery" : "gemstones";
    const [products] = await db.query(
      `SELECT id, ${itemType === "jewellery" ? "product_name AS name, stock_quantity AS stock" : "name, stock"}
       FROM ${table}
       WHERE id = ?`,
      [Number(itemId)]
    );

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: `${itemType === "jewellery" ? "Jewellery" : "Gemstone"} item not found`
      });
    }

    const product = products[0];
    const availableStock = Number(product.stock);
    if (!Number.isFinite(availableStock) || availableStock < 0) {
      return res.status(409).json({
        success: false,
        message: `Stock is unavailable for ${product.name}`
      });
    }

    if (cartQuantity > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${product.name}`,
        available_stock: availableStock,
        requested_quantity: cartQuantity
      });
    }

    const itemColumn = itemType === "jewellery" ? "jewellery_id" : "gemstone_id";
    const [existing] = await db.query(
      `SELECT id, quantity
       FROM cart
       WHERE user_id = ? AND ${itemColumn} = ?`,
      [user_id, Number(itemId)]
    );

    if (existing.length > 0) {
      const newQuantity = [true, 1, "1", "true"].includes(replace_quantity)
        ? cartQuantity
        : Number(existing[0].quantity) + cartQuantity;
      if (newQuantity > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
          available_stock: availableStock,
          requested_quantity: newQuantity
        });
      }

      await db.query(
        "UPDATE cart SET quantity = ?, updated_at = NOW() WHERE id = ? AND user_id = ?",
        [newQuantity, existing[0].id, user_id]
      );

      return res.status(200).json({
        success: true,
        message: "Cart quantity updated successfully",
        cart_id: existing[0].id,
        item_type: itemType,
        quantity: newQuantity
      });
    }

    const [result] = await db.query(
      `INSERT INTO cart
       (user_id, gemstone_id, jewellery_id, quantity, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [
        user_id,
        itemType === "gemstone" ? Number(itemId) : null,
        itemType === "jewellery" ? Number(itemId) : null,
        cartQuantity
      ]
    );

    return res.status(201).json({
      success: true,
      message: `${itemType === "jewellery" ? "Jewellery" : "Gemstone"} added to cart successfully`,
      cart_id: result.insertId,
      item_type: itemType,
      quantity: cartQuantity
    });
  } catch (error) {
    console.error("Add Cart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add item to cart",
      error: error.message
    });
  }
};

// Get the authenticated user's gemstone and jewellery cart items.
exports.getCart = async (req, res) => {
  try {
    const user_id = req.user.id;
    const [cart] = await db.query(
      `SELECT
        c.id,
        c.user_id,
        c.gemstone_id,
        c.jewellery_id,
        CASE WHEN c.jewellery_id IS NULL THEN 'gemstone' ELSE 'jewellery' END AS item_type,
        COALESCE(g.gemstone_id, j.product_code) AS product_code,
        COALESCE(g.name, j.product_name) AS name,
        COALESCE(g.color, j.color) AS color,
        g.carat,
        COALESCE(g.price, j.price) AS price,
        COALESCE(j.currency, 'USD') AS currency,
        c.quantity,
        (COALESCE(g.price, j.price) * c.quantity) AS subtotal,
        COALESCE(gi.image_url, j.image_url) AS image_url,
        c.created_at,
        c.updated_at
      FROM cart c
      LEFT JOIN gemstones g ON c.gemstone_id = g.id
      LEFT JOIN jewellery j ON c.jewellery_id = j.id
      LEFT JOIN gemstone_images gi
        ON g.id = gi.gemstone_id
        AND gi.is_primary = 1
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC`,
      [user_id]
    );

    return res.status(200).json({ success: true, data: cart });
  } catch (error) {
    console.error("Get Cart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cart",
      error: error.message
    });
  }
};

// Update the quantity of a gemstone or jewellery cart item.
exports.updateCart = async (req, res) => {
  try {
    const { id } = req.params;
    const requestedQuantity = Number(req.body.quantity);
    const user_id = req.user.id;

    if (!Number.isSafeInteger(requestedQuantity) || requestedQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer"
      });
    }

    const [cartItems] = await db.query(
      `SELECT
        c.id,
        c.gemstone_id,
        c.jewellery_id,
        COALESCE(g.name, j.product_name) AS name,
        COALESCE(g.stock, j.stock_quantity) AS stock
      FROM cart c
      LEFT JOIN gemstones g ON c.gemstone_id = g.id
      LEFT JOIN jewellery j ON c.jewellery_id = j.id
      WHERE c.id = ? AND c.user_id = ?`,
      [id, user_id]
    );

    if (cartItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found"
      });
    }

    const cartItem = cartItems[0];
    const availableStock = Number(cartItem.stock);
    if (requestedQuantity > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${cartItem.name}`,
        available_stock: availableStock,
        requested_quantity: requestedQuantity
      });
    }

    await db.query(
      "UPDATE cart SET quantity = ?, updated_at = NOW() WHERE id = ? AND user_id = ?",
      [requestedQuantity, id, user_id]
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

// Remove an item from the authenticated user's cart.
exports.deleteCart = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const [result] = await db.query(
      "DELETE FROM cart WHERE id = ? AND user_id = ?",
      [id, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found"
      });
    }

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
