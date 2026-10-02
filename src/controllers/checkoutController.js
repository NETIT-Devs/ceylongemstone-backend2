
const db = require("../config/db");

// Convert Currency
const convertCurrency = async (amount, from, to) => {
  if (from === to) {
    return Number(amount);
  }

  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${from}/${to}`
  );

  const data = await response.json();

  if (!response.ok || !data.rate) {
    throw new Error("Unable to get currency exchange rate");
  }

  return Number(
    (Number(amount) * Number(data.rate)).toFixed(2)
  );
};


// Checkout
exports.checkout = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      currency,
      shipping_address
    } = req.body;

    // Get user ID from JWT token
    const user_id = req.user.id;

    // Validate required fields
    if (!user_id || !currency || !shipping_address) {
      return res.status(400).json({
        success: false,
        message: "currency and shipping_address are required"
      });
    }

    const selectedCurrency = currency.toUpperCase();
    const baseCurrency = "USD";

    const supportedCurrencies = [
  "USD",
  "LKR",
  "EUR",
  "GBP",
  "AUD",
  "CAD"
];

if (!supportedCurrencies.includes(selectedCurrency)) {
  return res.status(400).json({
    success: false,
    message: "Unsupported currency",
    supported_currencies: supportedCurrencies
  });
}

    await connection.beginTransaction();

    // 1. Check user
    const [users] = await connection.query(
      "SELECT id FROM users WHERE id = ?",
      [user_id]
    );

    if (users.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }


    // 2. Get cart items with gemstone stock
    const [cartItems] = await connection.query(
      `SELECT
        c.id,
        c.gemstone_id,
        c.quantity,
        g.name,
        g.price,
        g.stock
      FROM cart c
      INNER JOIN gemstones g ON c.gemstone_id = g.id
      WHERE c.user_id = ?
      FOR UPDATE`,
      [user_id]
    );


    // 3. Check if cart is empty
    if (cartItems.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Cart is empty"
      });
    }


    // 4. Check stock availability
    for (const item of cartItems) {
      if (Number(item.stock) < Number(item.quantity)) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.name}`,
          available_stock: Number(item.stock),
          requested_quantity: Number(item.quantity)
        });
      }
    }


    // 5. Calculate total in USD
    let baseTotalAmount = 0;

    cartItems.forEach((item) => {
      baseTotalAmount +=
        Number(item.price) * Number(item.quantity);
    });


    // 6. Convert total from USD to selected currency
    const totalAmount = await convertCurrency(
      baseTotalAmount,
      baseCurrency,
      selectedCurrency
    );


    // 7. Generate order number
    const orderNumber = "ORD-" + Date.now();


    // 8. Create order
    const [orderResult] = await connection.query(
      `INSERT INTO orders
       (
         user_id,
         order_number,
         total_amount,
         currency,
         shipping_address,
         payment_status,
         order_status,
         created_at
       )
       VALUES (?, ?, ?, ?, ?, 'PENDING', 'PENDING', NOW())`,
      [
        user_id,
        orderNumber,
        totalAmount,
        selectedCurrency,
        shipping_address
      ]
    );

    const orderId = orderResult.insertId;


    // 9. Create order items and reduce stock
    for (const item of cartItems) {

      // Convert individual item price
      const convertedItemPrice = await convertCurrency(
        Number(item.price),
        baseCurrency,
        selectedCurrency
      );


      // Create order item
      await connection.query(
        `INSERT INTO order_items
         (
           order_id,
           gemstone_id,
           quantity,
           price,
           currency
         )
         VALUES (?, ?, ?, ?, ?)`,
        [
          orderId,
          item.gemstone_id,
          item.quantity,
          convertedItemPrice,
          selectedCurrency
        ]
      );


      // Reduce gemstone stock
      await connection.query(
        `UPDATE gemstones
         SET stock = stock - ?
         WHERE id = ?`,
        [
          item.quantity,
          item.gemstone_id
        ]
      );
    }


    // 10. Clear cart
    await connection.query(
      "DELETE FROM cart WHERE user_id = ?",
      [user_id]
    );


    // 11. Commit transaction
    await connection.commit();


    // 12. Success response
    return res.status(201).json({
      success: true,
      message: "Checkout completed successfully",
      order_id: orderId,
      order_number: orderNumber,
      total_amount: totalAmount,
      currency: selectedCurrency
    });


  } catch (error) {

    await connection.rollback();

    console.error("Checkout Error:", error);

    return res.status(500).json({
      success: false,
      message: "Checkout failed",
      error: error.message
    });

  } finally {
    connection.release();
  }
};


