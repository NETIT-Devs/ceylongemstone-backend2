const express = require("express");

const {
  createShippingMethod,
  getShippingMethods,
  getActiveShippingMethods,
  getShippingMethodById,
  updateShippingMethod,
  deleteShippingMethod
} = require("../controllers/shippingController");

const router = express.Router();

router.post("/", createShippingMethod);

router.get("/", getShippingMethods);

router.get("/active", getActiveShippingMethods);

router.get("/:id", getShippingMethodById);

router.put("/:id", updateShippingMethod);

router.delete("/:id", deleteShippingMethod);

module.exports = router;