const express = require("express");

const {
  // Shipping Methods
  createShippingMethod,
  getShippingMethods,
  getActiveShippingMethods,
  getShippingMethodById,
  updateShippingMethod,
  deleteShippingMethod,

  // Shipment & Tracking
  createShipment,
  getAllShipments,
  getShipmentByOrder,
  getShipmentByTrackingNumber,
  updateShipmentStatus,
  updateTrackingInformation

} = require("../controllers/shippingController");

const router = express.Router();


// ======================================================
// SHIPPING METHODS
// ======================================================

// Create Shipping Method
router.post("/", createShippingMethod);

// Get All Shipping Methods
router.get("/", getShippingMethods);

// Get Active Shipping Methods
router.get("/active", getActiveShippingMethods);

// Get Shipping Method by ID
router.get("/:id", getShippingMethodById);

// Update Shipping Method
router.put("/:id", updateShippingMethod);

// Delete Shipping Method
router.delete("/:id", deleteShippingMethod);


// ======================================================
// SHIPMENT & LOGISTICS TRACKING
// ======================================================

// Create Shipment
router.post("/shipments", createShipment);

// Get All Shipments
router.get("/shipments", getAllShipments);

// Get Shipment by Order ID
router.get("/shipments/order/:order_id", getShipmentByOrder);

// Get Shipment by Tracking Number
router.get(
  "/shipments/tracking/:tracking_number",
  getShipmentByTrackingNumber
);

// Update Shipment Status
router.put(
  "/shipments/:id/status",
  updateShipmentStatus
);

// Update Tracking Information
router.put(
  "/shipments/:id/tracking",
  updateTrackingInformation
);


module.exports = router;