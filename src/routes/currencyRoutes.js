const express = require("express");

const {
  getCurrencyRates,
  convertCurrency,
  getSupportedCurrencies
} = require("../controllers/currencyController");

const router = express.Router();

// Get currency exchange rates
router.get("/rates", getCurrencyRates);
router.get("/convert", convertCurrency);
router.get("/supported", getSupportedCurrencies);

module.exports = router;

