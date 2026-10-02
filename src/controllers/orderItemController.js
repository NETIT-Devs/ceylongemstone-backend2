const db = require("../config/db");

// Create Order Item
exports.createOrderItem = async (req, res) => {
  try {
    const {
      order_id,
      gemstone_id,
      quantity,
      price
    } = req.body;

    if (!order_id || !gemstone_id || !quantity || !price) {
      return res.status(400).json({
        success: false,
        message: "order_id, gemstone_id, quantity and price are required"
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

    // Check gemstone exists
    const [gemstone] = await db.query(
      "SELECT id FROM gemstones WHERE id = ?",
      [gemstone_id]
    );

    if (gemstone.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gemstone not found"
      });
    }

    const [result] = await db.query(
      `INSERT INTO order_items
       (order_id, gemstone_id, quantity, price)
       VALUES (?, ?, ?, ?)`,
      [
        order_id,
        gemstone_id,
        quantity,
        price
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
        g.gemstone_id AS gemstone_code,
        g.name AS gemstone_name,
        oi.quantity,
        oi.price,
        (oi.quantity * oi.price) AS subtotal
      FROM order_items oi
      INNER JOIN gemstones g ON oi.gemstone_id = g.id
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