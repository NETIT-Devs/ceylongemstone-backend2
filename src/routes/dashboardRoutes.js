const express = require("express");
const {
  getDashboardStats,
  getLowStockItems,
  addStock
} = require("../controllers/dashboardController");

const router = express.Router();

router.get("/stats", getDashboardStats);
router.get("/low-stock", getLowStockItems);
router.post("/stock/:type/:id/restock", addStock);

module.exports = router;
