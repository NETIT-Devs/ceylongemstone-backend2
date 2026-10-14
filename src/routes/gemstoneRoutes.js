const express = require("express");
const router = express.Router();
const gemstoneController = require("../controllers/gemstoneController");
const gemstoneMediaUpload = require("../middleware/gemstoneMediaUpload");

router.get("/", gemstoneController.getAllGemstones);
router.get("/low-stock", gemstoneController.getLowStockGemstones);
router.get("/:id", gemstoneController.getGemstoneById);
router.post("/", gemstoneMediaUpload, gemstoneController.createGemstone);
router.put("/:id", gemstoneController.updateGemstone);
router.delete("/:id", gemstoneController.deleteGemstone);

module.exports = router; 