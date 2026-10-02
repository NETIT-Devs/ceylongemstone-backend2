const express = require("express");

const {
  createOrder,
  getOrders,
  updateOrderStatus,
  updatePaymentStatus,
  getUserOrders,
  cancelOrder
} = require("../controllers/orderController");

const router = express.Router();

router.post("/", createOrder);
router.get("/", getOrders);
router.put("/:id/status", updateOrderStatus);
router.put("/:id/payment-status", updatePaymentStatus);
router.get("/user/:user_id", getUserOrders);
router.put("/:id/cancel", cancelOrder);

module.exports = router;