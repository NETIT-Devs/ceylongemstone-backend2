const db = require("../config/db");

// Create Order Item
exports.createOrderItem = async (req, res) => {
  try {
    const {
      order_id,
      gemstone_id,
      jewellery_id,
      quantity,
      price,
      currency = "USD"
    } = req.body;

    const hasGemstone = gemstone_id !== undefined && gemstone_id !== null;
    const hasJewellery = jewellery_id !== undefined && jewellery_id !== null;
    const productId = hasJewellery ? jewellery_id : gemstone_id;
    const productTable = hasJewellery ? "jewellery" : "gemstones";

    if (
      !order_id ||
      hasGemstone === hasJewellery ||
      !Number.isSafeInteger(Number(productId)) ||
      Number(productId) < 1 ||
      !Number.isSafeInteger(Number(quantity)) ||
      Number(quantity) < 1 ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0 ||
      typeof currency !== "string" ||
      currency.trim().length !== 3
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide an order, exactly one product ID, a valid quantity, price and currency."
      });
    }

    // Check order exists
    const [order] = await db.query(
      "SELECT id FROM orders WHERE id = ?",
      [order_id]
    );

    if (order.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const [product] = await db.query(
      `SELECT id FROM ${productTable} WHERE id = ?`,
      [productId]
    );

    if (product.length === 0) {
      return res.status(404).json({
        success: false,
        message: hasJewellery ? "Jewellery item not found" : "Gemstone not found"
      });
    }

    const [result] = await db.query(
      `INSERT INTO order_items
       (order_id, gemstone_id, jewellery_id, quantity, price, currency)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        order_id,
        hasGemstone ? gemstone_id : null,
        hasJewellery ? jewellery_id : null,
        quantity,
        price,
        currency.trim().toUpperCase()
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Order item created successfully",
      order_item_id: result.insertId
    });

  } catch (error) {
    console.error("Create Order Item Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create order item",
      error: error.message
    });
  }
};

// Get Order Items
exports.getOrderItems = async (req, res) => {
  try {
    const { order_id } = req.params;

    const [items] = await db.query(
      `SELECT
        oi.id,
        oi.order_id,
        oi.gemstone_id,
        oi.jewellery_id,
        CASE WHEN oi.jewellery_id IS NULL THEN 'gemstone' ELSE 'jewellery' END AS item_type,
        COALESCE(g.gemstone_id, j.product_code) AS product_code,
        COALESCE(g.name, j.product_name) AS name,
        COALESCE(g.name, j.product_name) AS gemstone_name,
        g.carat,
        g.cut,
        g.shape,
        g.origin,
        COALESCE(gi.image_url, j.image_url) AS image_url,
        oi.quantity,
        oi.price,
        oi.currency,
        (oi.quantity * oi.price) AS subtotal
      FROM order_items oi
      LEFT JOIN gemstones g ON oi.gemstone_id = g.id
      LEFT JOIN jewellery j ON oi.jewellery_id = j.id
      LEFT JOIN gemstone_images gi
        ON gi.gemstone_id = g.id
        AND gi.is_primary = 1
      WHERE oi.order_id = ?
      ORDER BY oi.id DESC`,
      [order_id]
    );

    return res.status(200).json({
      success: true,
      data: items
    });

  } catch (error) {
    console.error("Get Order Items Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch order items",
      error: error.message
    });
  }
};

// Update Order Item
exports.updateOrderItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, price } = req.body;

    if (!quantity || Number(quantity) < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1"
      });
    }

    if (price === undefined || Number(price) < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a valid amount"
      });
    }

    const [item] = await db.query(
      "SELECT id FROM order_items WHERE id = ?",
      [id]
    );

    if (item.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    await db.query(
      `UPDATE order_items
       SET quantity = ?, price = ?
       WHERE id = ?`,
      [
        Number(quantity),
        Number(price),
        id
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Order item updated successfully",
      order_item_id: Number(id),
      quantity: Number(quantity),
      price: Number(price)
    });

  } catch (error) {
    console.error("Update Order Item Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update order item",
      error: error.message
    });
  }
};

// Delete Order Item
exports.deleteOrderItem = async (req, res) => {
  try {
    const { id } = req.params;

    const [item] = await db.query(
      "SELECT id FROM order_items WHERE id = ?",
      [id]
    );

    if (item.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    await db.query(
      "DELETE FROM order_items WHERE id = ?",
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Order item deleted successfully"
    });

  } catch (error) {
    console.error("Delete Order Item Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete order item",
      error: error.message
    });
  }
};