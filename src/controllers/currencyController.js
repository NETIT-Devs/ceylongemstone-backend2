
// Get Currency Rates
const getCurrencyRates = async (req, res) => {
  try {
    const base = (req.query.base || "USD").toUpperCase();

    const response = await fetch(
      `https://api.frankfurter.dev/v2/rates?base=${base}`
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data.message || "Failed to fetch currency rates"
      });
    }

    return res.status(200).json({
      success: true,
      base_currency: base,
      rates: data
    });

  } catch (error) {
    console.error("Currency API Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch currency rates",
      error: error.message
    });
  }
};


// Convert Currency
const convertCurrency = async (req, res) => {
  try {
    const {
      from = "USD",
      to = "LKR",
      amount
    } = req.query;

    const fromCurrency = from.toUpperCase();
    const toCurrency = to.toUpperCase();
    const numericAmount = Number(amount);

    // Validate amount
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid amount is required"
      });
    }

    // Same currency
    if (fromCurrency === toCurrency) {
      return res.status(200).json({
        success: true,
        from: fromCurrency,
        to: toCurrency,
        amount: numericAmount,
        exchange_rate: 1,
        converted_amount: numericAmount
      });
    }

    // Get exchange rate
    const response = await fetch(
      `https://api.frankfurter.dev/v2/rate/${fromCurrency}/${toCurrency}`
    );

    const data = await response.json();

    if (!response.ok || !data.rate) {
      return res.status(400).json({
        success: false,
        message: "Unable to get exchange rate"
      });
    }

    const exchangeRate = Number(data.rate);
    const convertedAmount = numericAmount * exchangeRate;

    return res.status(200).json({
      success: true,
      from: fromCurrency,
      to: toCurrency,
      amount: numericAmount,
      exchange_rate: exchangeRate,
      converted_amount: Number(convertedAmount.toFixed(2)),
      date: data.date
    });

  } catch (error) {
    console.error("Currency Conversion Error:", error);

    return res.status(500).json({
      success: false,
      message: "Currency conversion failed",
      error: error.message
    });
  }
};


// Get Supported Currencies
const getSupportedCurrencies = (req, res) => {
  const currencies = [
    {
      code: "USD",
      name: "US Dollar",
      symbol: "$"
    },
    {
      code: "LKR",
      name: "Sri Lankan Rupee",
      symbol: "Rs"
    },
    {
      code: "EUR",
      name: "Euro",
      symbol: "€"
    },
    {
      code: "GBP",
      name: "British Pound",
      symbol: "£"
    },
    {
      code: "AUD",
      name: "Australian Dollar",
      symbol: "A$"
    },
    {
      code: "CAD",
      name: "Canadian Dollar",
      symbol: "C$"
    }
  ];

  return res.status(200).json({
    success: true,
    currencies
  });
};


// Export all functions
module.exports = {
  getCurrencyRates,
  convertCurrency,
  getSupportedCurrencies
};


