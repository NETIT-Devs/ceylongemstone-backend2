const db = require("../config/db");

// ======================================================
// SHIPPING METHODS
// ======================================================

// Create Shipping Method
const createShippingMethod = async (req, res) => {
  try {
    const {
      country,
      shipping_method,
      estimated_days,
      shipping_cost,
      currency,
      free_shipping,
      status
    } = req.body;

    if (!country || !shipping_method) {
      return res.status(400).json({
        success: false,
        message: "country and shipping_method are required"
      });
    }

    const [result] = await db.query(
      `INSERT INTO shipping_methods
      (
        country,
        shipping_method,
        estimated_days,
        shipping_cost,
        currency,
        free_shipping,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        country,
        shipping_method,
        estimated_days || null,
        shipping_cost !== undefined ? shipping_cost : 0,
        currency || "USD",
        free_shipping !== undefined ? free_shipping : 0,
        status !== undefined ? status : 1
      ]
    );

    res.status(201).json({
      success: true,
      message: "Shipping method created successfully",
      shipping_id: result.insertId
    });

  } catch (error) {
    console.error("Create Shipping Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create shipping method",
      error: error.message
    });
  }
};


// Get All Shipping Methods
const getShippingMethods = async (req, res) => {
  try {
    const [methods] = await db.query(
      `SELECT *
       FROM shipping_methods
       ORDER BY created_at DESC`
    );

    res.status(200).json({
      success: true,
      count: methods.length,
      shipping_methods: methods
    });

  } catch (error) {
    console.error("Get Shipping Methods Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch shipping methods",
      error: error.message
    });
  }
};


// Get Active Shipping Methods
const getActiveShippingMethods = async (req, res) => {
  try {
    const [methods] = await db.query(
      `SELECT *
       FROM shipping_methods
       WHERE status = 1
       ORDER BY country ASC`
    );

    res.status(200).json({
      success: true,
      count: methods.length,
      shipping_methods: methods
    });

  } catch (error) {
    console.error("Get Active Shipping Methods Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch active shipping methods",
      error: error.message
    });
  }
};


// Get Shipping Method by ID
const getShippingMethodById = async (req, res) => {
  try {
    const { id } = req.params;

    const [methods] = await db.query(
      "SELECT * FROM shipping_methods WHERE id = ?",
      [id]
    );

    if (methods.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Shipping method not found"
      });
    }

    res.status(200).json({
      success: true,
      shipping_method: methods[0]
    });

  } catch (error) {
    console.error("Get Shipping Method Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch shipping method",
      error: error.message
    });
  }
};


// Update Shipping Method
const updateShippingMethod = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      country,
      shipping_method,
      estimated_days,
      shipping_cost,
      currency,
      free_shipping,
      status
    } = req.body;

    const [existing] = await db.query(
      "SELECT id FROM shipping_methods WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Shipping method not found"
      });
    }

    await db.query(
      `UPDATE shipping_methods
       SET
         country = COALESCE(?, country),
         shipping_method = COALESCE(?, shipping_method),
         estimated_days = COALESCE(?, estimated_days),
         shipping_cost = COALESCE(?, shipping_cost),
         currency = COALESCE(?, currency),
         free_shipping = COALESCE(?, free_shipping),
         status = COALESCE(?, status)
       WHERE id = ?`,
      [
        country || null,
        shipping_method || null,
        estimated_days || null,
        shipping_cost !== undefined ? shipping_cost : null,
        currency || null,
        free_shipping !== undefined ? free_shipping : null,
        status !== undefined ? status : null,
        id
      ]
    );

    res.status(200).json({
      success: true,
      message: "Shipping method updated successfully"
    });

  } catch (error) {
    console.error("Update Shipping Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update shipping method",
      error: error.message
    });
  }
};


// Delete Shipping Method
const deleteShippingMethod = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      "DELETE FROM shipping_methods WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Shipping method not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Shipping method deleted successfully"
    });

  } catch (error) {
    console.error("Delete Shipping Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete shipping method",
      error: error.message
    });
  }
};


// ======================================================
// SHIPMENT & LOGISTICS TRACKING
// ======================================================

// Create Shipment
const createShipment = async (req, res) => {
  try {
    const {
      order_id,
      shipping_method_id,
      tracking_number,
      courier,
      estimated_delivery
    } = req.body;

    if (!order_id || !shipping_method_id) {
      return res.status(400).json({
        success: false,
        message: "order_id and shipping_method_id are required"
      });
    }

    // Check Order
    const [orders] = await db.query(
      "SELECT id FROM orders WHERE id = ?",
      [order_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check Shipping Method
    const [shippingMethods] = await db.query(
      "SELECT id FROM shipping_methods WHERE id = ?",
      [shipping_method_id]
    );

    if (shippingMethods.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Shipping method not found"
      });
    }

    // Check Existing Shipment
    const [existingShipment] = await db.query(
      "SELECT id FROM shipments WHERE order_id = ?",
      [order_id]
    );

    if (existingShipment.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Shipment already exists for this order"
      });
    }

    const [result] = await db.query(
      `INSERT INTO shipments
      (
        order_id,
        shipping_method_id,
        tracking_number,
        courier,
        status,
        estimated_delivery
      )
      VALUES (?, ?, ?, ?, 'PENDING', ?)`,
      [
        order_id,
        shipping_method_id,
        tracking_number || null,
        courier || null,
        estimated_delivery || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Shipment created successfully",
      shipment_id: result.insertId
    });

  } catch (error) {
    console.error("Create Shipment Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create shipment",
      error: error.message
    });
  }
};


// Get All Shipments
const getAllShipments = async (req, res) => {
  try {
    const [shipments] = await db.query(
      `SELECT
        s.*,
        o.order_number,
        sm.country,
        sm.shipping_method
      FROM shipments s
      INNER JOIN orders o
        ON s.order_id = o.id
      INNER JOIN shipping_methods sm
        ON s.shipping_method_id = sm.id
      ORDER BY s.created_at DESC`
    );

    res.status(200).json({
      success: true,
      count: shipments.length,
      shipments
    });

  } catch (error) {
    console.error("Get All Shipments Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch shipments",
      error: error.message
    });
  }
};


// Get Shipment by Order ID
const getShipmentByOrder = async (req, res) => {
  try {
    const { order_id } = req.params;

    const [shipments] = await db.query(
      `SELECT
        s.*,
        o.order_number,
        sm.country,
        sm.shipping_method,
        sm.shipping_cost,
        sm.currency
      FROM shipments s
      INNER JOIN orders o
        ON s.order_id = o.id
      INNER JOIN shipping_methods sm
        ON s.shipping_method_id = sm.id
      WHERE s.order_id = ?`,
      [order_id]
    );

    if (shipments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Shipment not found for this order"
      });
    }

    res.status(200).json({
      success: true,
      shipment: shipments[0]
    });

  } catch (error) {
    console.error("Get Shipment Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch shipment",
      error: error.message
    });
  }
};


// Get Shipment by Tracking Number
const getShipmentByTrackingNumber = async (req, res) => {
  try {
    const { tracking_number } = req.params;

    const [shipments] = await db.query(
      `SELECT
        s.*,
        o.order_number,
        sm.country,
        sm.shipping_method,
        sm.shipping_cost,
        sm.currency
      FROM shipments s
      INNER JOIN orders o
        ON s.order_id = o.id
      INNER JOIN shipping_methods sm
        ON s.shipping_method_id = sm.id
      WHERE s.tracking_number = ?`,
      [tracking_number]
    );

    if (shipments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Shipment not found"
      });
    }

    res.status(200).json({
      success: true,
      shipment: shipments[0]
    });

  } catch (error) {
    console.error("Get Shipment Tracking Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch shipment tracking information",
      error: error.message
    });
  }
};


// Update Shipment Status
const updateShipmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "PENDING",
      "SHIPPED",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED"
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shipment status"
      });
    }

    const [existing] = await db.query(
      "SELECT id FROM shipments WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Shipment not found"
      });
    }

    // Update shipped time
    if (status === "SHIPPED") {

      await db.query(
        `UPDATE shipments
         SET
           status = ?,
           shipped_at = NOW()
         WHERE id = ?`,
        [status, id]
      );

    // Update delivered time
    } else if (status === "DELIVERED") {

      await db.query(
        `UPDATE shipments
         SET
           status = ?,
           delivered_at = NOW()
         WHERE id = ?`,
        [status, id]
      );

    } else {

      await db.query(
        `UPDATE shipments
         SET status = ?
         WHERE id = ?`,
        [status, id]
      );
    }

    res.status(200).json({
      success: true,
      message: "Shipment status updated successfully"
    });

  } catch (error) {
    console.error("Update Shipment Status Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update shipment status",
      error: error.message
    });
  }
};


// Update Tracking Information
const updateTrackingInformation = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      tracking_number,
      courier,
      estimated_delivery
    } = req.body;

    const [existing] = await db.query(
      "SELECT id FROM shipments WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Shipment not found"
      });
    }

    await db.query(
      `UPDATE shipments
       SET
         tracking_number = COALESCE(?, tracking_number),
         courier = COALESCE(?, courier),
         estimated_delivery = COALESCE(?, estimated_delivery)
       WHERE id = ?`,
      [
        tracking_number || null,
        courier || null,
        estimated_delivery || null,
        id
      ]
    );

    res.status(200).json({
      success: true,
      message: "Tracking information updated successfully"
    });

  } catch (error) {
    console.error("Update Tracking Information Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update tracking information",
      error: error.message
    });
  }
};


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  // Shipping Methods
  createShippingMethod,
  getShippingMethods,
  getActiveShippingMethods,
  getShippingMethodById,
  updateShippingMethod,
  deleteShippingMethod,

  // Shipment Tracking
  createShipment,
  getAllShipments,
  getShipmentByOrder,
  getShipmentByTrackingNumber,
  updateShipmentStatus,
  updateTrackingInformation
};