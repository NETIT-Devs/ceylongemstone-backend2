const db = require("../config/db");

// Create Order
exports.createOrder = async (req, res) => {
  try {
    const {
      user_id,
      order_number,
      total_amount,
      currency,
      shipping_address
    } = req.body;

    if (!user_id || !order_number || !total_amount || !currency || !shipping_address) {
      return res.status(400).json({
        success: false,
        message: "user_id, order_number, total_amount, currency and shipping_address are required"
      });
    }

    // Check user exists
    const [user] = await db.query(
      "SELECT id FROM users WHERE id = ?",
      [user_id]
    );

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check duplicate order number
    const [existingOrder] = await db.query(
      "SELECT id FROM orders WHERE order_number = ?",
      [order_number]
    );

    if (existingOrder.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Order number already exists"
      });
    }

    const [result] = await db.query(
      `INSERT INTO orders
       (user_id, order_number, total_amount, currency, shipping_address, payment_status, order_status, created_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', 'PENDING', NOW())`,
      [
        user_id,
        order_number,
        total_amount,
        currency,
        shipping_address
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      order_id: result.insertId,
      order_number: order_number
    });

  } catch (error) {
    console.error("Create Order Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message
    });
  }
};

// Get All Orders
exports.getOrders = async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT
        o.id,
        o.user_id,
        u.name AS customer_name,
        u.email AS customer_email,
        o.order_number,
        o.total_amount,
        o.currency,
        o.shipping_address,
        o.payment_status,
        o.order_status,
        o.created_at
      FROM orders o
      INNER JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      data: orders
    });

  } catch (error) {
    console.error("Get Orders Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message
    });
  }
};

// Update Order Status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { order_status } = req.body;

    const allowedStatuses = [
      "PENDING",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED"
    ];

    if (
      !order_status ||
      !allowedStatuses.includes(order_status.toUpperCase())
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Order status must be PENDING, PROCESSING, SHIPPED, DELIVERED or CANCELLED"
      });
    }

    const [order] = await db.query(
      "SELECT id FROM orders WHERE id = ?",
      [id]
    );

    if (order.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const updatedStatus = order_status.toUpperCase();

    await db.query(
      "UPDATE orders SET order_status = ? WHERE id = ?",
      [updatedStatus, id]
    );

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order_id: Number(id),
      order_status: updatedStatus
    });

  } catch (error) {
    console.error("Update Order Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message
    });
  }
};

// Update Payment Status
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;

    const allowedStatuses = [
      "PENDING",
      "PAID",
      "FAILED",
      "REFUNDED"
    ];

    if (
      !payment_status ||
      !allowedStatuses.includes(payment_status.toUpperCase())
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment status must be PENDING, PAID, FAILED or REFUNDED"
      });
    }

    const [order] = await db.query(
      "SELECT id FROM orders WHERE id = ?",
      [id]
    );

    if (order.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const updatedStatus = payment_status.toUpperCase();

    await db.query(
      "UPDATE orders SET payment_status = ? WHERE id = ?",
      [updatedStatus, id]
    );

    return res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      order_id: Number(id),
      payment_status: updatedStatus
    });

  } catch (error) {
    console.error("Update Payment Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update payment status",
      error: error.message
    });
  }
};

// Get Orders by User
exports.getUserOrders = async (req, res) => {
  try {
    const { user_id } = req.params;

    const [orders] = await db.query(
      `SELECT
        id,
        user_id,
        order_number,
        total_amount,
        currency,
        shipping_address,
        payment_status,
        order_status,
        created_at
      FROM orders
      WHERE user_id = ?
      ORDER BY created_at DESC`,
      [user_id]
    );

    return res.status(200).json({
      success: true,
      data: orders
    });

  } catch (error) {
    console.error("Get User Orders Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user orders",
      error: error.message
    });
  }
};

// Cancel Order
exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const [orders] = await db.query(
      "SELECT id, order_status FROM orders WHERE id = ?",
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (orders[0].order_status === "DELIVERED") {
      return res.status(400).json({
        success: false,
        message: "Delivered order cannot be cancelled"
      });
    }

    if (orders[0].order_status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled"
      });
    }

    await db.query(
      "UPDATE orders SET order_status = 'CANCELLED' WHERE id = ?",
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order_id: Number(id),
      order_status: "CANCELLED"
    });

  } catch (error) {
    console.error("Cancel Order Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message
    });
  }
};

