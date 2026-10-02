const express = require("express");

const {
  addToCart,
  getCart,
  updateCart,
  deleteCart
} = require("../controllers/cartController");

const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

// Protected cart routes
router.post("/", verifyToken, addToCart);

router.get("/:user_id", verifyToken, getCart);

router.put("/:id", verifyToken, updateCart);

router.delete("/:id", verifyToken, deleteCart);

module.exports = router;