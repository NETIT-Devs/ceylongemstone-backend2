const express = require("express");

const {
  createOrderItem,
  getOrderItems,
  updateOrderItem,
  deleteOrderItem
} = require("../controllers/orderItemController");

const router = express.Router();

router.post("/", createOrderItem);
router.get("/:order_id", getOrderItems);
router.put("/:id", updateOrderItem);
router.delete("/:id", deleteOrderItem);

module.exports = router;