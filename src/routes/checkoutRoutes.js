const express = require("express");

const {
  checkout
} = require("../controllers/checkoutController");

const {
  verifyToken
} = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", verifyToken, checkout);

module.exports = router;