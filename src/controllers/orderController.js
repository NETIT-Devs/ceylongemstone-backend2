const db = require("../config/db");

const isValidDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

// Create Order
exports.createOrder = async (req, res) => {
  try {
    const {
      user_id,
      order_number,
      total_amount,
      shipping_cost,
      currency,
      shipping_address
    } = req.body;

    // Validate required fields
    if (
      !user_id ||
      !order_number ||
      !total_amount ||
      shipping_cost === undefined ||
      !currency ||
      !shipping_address
    ) {
      return res.status(400).json({
        success: false,
        message:
          "user_id, order_number, total_amount, shipping_cost, currency and shipping_address are required"
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

    // Create order
    const [result] = await db.query(
      `INSERT INTO orders
      (
        user_id,
        order_number,
        total_amount,
        shipping_cost,
        currency,
        shipping_address,
        payment_status,
        order_status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING', NOW())`,
      [
        user_id,
        order_number,
        total_amount,
        shipping_cost,
        currency,
        shipping_address
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      order_id: result.insertId,
      order_number: order_number,
      total_amount: total_amount,
      shipping_cost: shipping_cost,
      currency: currency
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
  const { startDate, endDate } = req.query;

  if ((startDate && !isValidDate(startDate)) || (endDate && !isValidDate(endDate))) {
    return res.status(400).json({
      success: false,
      message: "startDate and endDate must be valid dates in YYYY-MM-DD format."
    });
  }

  if (startDate && endDate && startDate > endDate) {
    return res.status(400).json({
      success: false,
      message: "startDate must be on or before endDate."
    });
  }

  const dateConditions = [];
  const dateParams = [];

  if (startDate) {
    dateConditions.push("o.created_at >= ?");
    dateParams.push(startDate);
  }
  if (endDate) {
    dateConditions.push("o.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    dateParams.push(endDate);
  }
  const dateFilter = dateConditions.length
    ? `WHERE ${dateConditions.join(" AND ")}`
    : "";

  try {
    const [orders] = await db.query(
      `SELECT
        o.id,
        o.user_id,
        u.name AS customer_name,
        u.email AS customer_email,
        o.order_number,
        o.total_amount,
        o.shipping_cost,
        COALESCE(o.total_amount, 0) + COALESCE(o.shipping_cost, 0) AS final_total,
        o.currency,
        o.shipping_address,
        o.payment_status,
        o.order_status,
        o.created_at
      FROM orders o
      INNER JOIN users u
        ON o.user_id = u.id
      ${dateFilter}
      ORDER BY o.created_at DESC`,
      dateParams
    );

    const itemsByOrderId = new Map();
    if (orders.length > 0) {
      const placeholders = orders.map(() => "?").join(", ");
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
          j.material,
          j.gemstone_type,
          j.jewellery_type,
          j.is_handcrafted,
          COALESCE(gi.image_url, j.image_url) AS image_url,
          oi.quantity,
          oi.price,
          oi.original_price,
          oi.discount_rate,
          oi.currency
        FROM order_items oi
        LEFT JOIN gemstones g
          ON oi.gemstone_id = g.id
        LEFT JOIN jewellery j
          ON oi.jewellery_id = j.id
        LEFT JOIN gemstone_images gi
          ON gi.gemstone_id = g.id
          AND gi.is_primary = 1
        WHERE oi.order_id IN (${placeholders})
        ORDER BY oi.id`,
        orders.map((order) => order.id)
      );

      for (const item of items) {
        const orderItems = itemsByOrderId.get(item.order_id) || [];
        orderItems.push(item);
        itemsByOrderId.set(item.order_id, orderItems);
      }
    }

    return res.status(200).json({
      success: true,
      data: orders.map((order) => ({
        ...order,
        items: itemsByOrderId.get(order.id) || []
      }))
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


// Get Order by ID
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const [orders] = await db.query(
      `SELECT
        o.id,
        o.user_id,
        u.name AS customer_name,
        u.email AS customer_email,
        o.order_number,
        o.total_amount,
        o.shipping_cost,
        COALESCE(o.total_amount, 0) + COALESCE(o.shipping_cost, 0) AS final_total,
        o.currency,
        o.shipping_address,
        o.payment_status,
        o.order_status,
        o.created_at
      FROM orders o
      INNER JOIN users u
        ON o.user_id = u.id
      WHERE o.id = ?`,
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: orders[0]
    });

  } catch (error) {
    console.error("Get Order By ID Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch order",
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
        o.id,
        o.user_id,
        o.order_number,
        o.total_amount,
        o.shipping_cost,
        COALESCE(o.total_amount, 0) + COALESCE(o.shipping_cost, 0) AS final_total,
        o.currency,
        o.shipping_address,
        COALESCE(order_sm.shipping_method, shipment_sm.shipping_method) AS shipping_method,
        s.tracking_number,
        s.courier,
        s.estimated_delivery,
        s.status AS shipment_status,
        o.payment_status,
        o.order_status,
        o.created_at
      FROM orders o
      LEFT JOIN shipments s
        ON s.order_id = o.id
      LEFT JOIN shipping_methods order_sm
        ON order_sm.id = o.shipping_method_id
      LEFT JOIN shipping_methods shipment_sm
        ON shipment_sm.id = s.shipping_method_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC`,
      [user_id]
    );

    const itemsByOrderId = new Map();
    if (orders.length > 0) {
      const placeholders = orders.map(() => "?").join(", ");
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
          j.material,
          j.gemstone_type,
          j.jewellery_type,
          j.is_handcrafted,
          COALESCE(gi.image_url, j.image_url) AS image_url,
          (
            SELECT c.certificate_number
            FROM certificates c
            WHERE c.gemstone_id = g.id
            ORDER BY c.created_at DESC, c.id DESC
            LIMIT 1
          ) AS certificate_number,
          oi.quantity,
          oi.price,
          oi.original_price,
          oi.discount_rate,
          oi.currency
        FROM order_items oi
        LEFT JOIN gemstones g
          ON oi.gemstone_id = g.id
        LEFT JOIN jewellery j
          ON oi.jewellery_id = j.id
        LEFT JOIN gemstone_images gi
          ON gi.gemstone_id = g.id
          AND gi.is_primary = 1
        WHERE oi.order_id IN (${placeholders})
        ORDER BY oi.id`,
        orders.map((order) => order.id)
      );

      for (const item of items) {
        const orderItems = itemsByOrderId.get(item.order_id) || [];
        orderItems.push(item);
        itemsByOrderId.set(item.order_id, orderItems);
      }
    }

    return res.status(200).json({
      success: true,
      data: orders.map((order) => ({
        ...order,
        items: itemsByOrderId.get(order.id) || []
      }))
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