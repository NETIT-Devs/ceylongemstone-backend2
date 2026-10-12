const express = require("express");
const router = express.Router();
const gemstoneController = require("../controllers/gemstoneController");

router.get("/", gemstoneController.getAllGemstones);
router.get("/low-stock", gemstoneController.getLowStockGemstones);
router.get("/:id", gemstoneController.getGemstoneById);
router.post("/", gemstoneController.createGemstone);
router.put("/:id", gemstoneController.updateGemstone);
router.delete("/:id", gemstoneController.deleteGemstone);

module.exports = router; 