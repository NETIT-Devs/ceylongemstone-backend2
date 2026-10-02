const db = require("../config/db");

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


module.exports = {
  createShippingMethod,
  getShippingMethods,
  getActiveShippingMethods,
  getShippingMethodById,
  updateShippingMethod,
  deleteShippingMethod
};