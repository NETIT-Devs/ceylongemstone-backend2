const express = require("express");

const {
  addToWishlist,
  getWishlist,
  deleteWishlist
} = require("../controllers/wishlistController");

const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/",
  verifyToken,
  addToWishlist
);

router.get(
  "/:user_id",
  getWishlist
);

router.delete(
  "/:id", deleteWishlist
);


module.exports = router;