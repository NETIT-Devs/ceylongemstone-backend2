const db = require("../config/db");

// List currencies accepted by checkout and price conversion.
const supportedCurrencies = ["USD", "LKR", "EUR", "GBP", "AUD", "CAD"];

// Convert an amount between currencies and round it to two decimal places.
const convertCurrency = async (amount, from, to) => {
  // Avoid a network request when the amount is already in the requested currency.
  if (from === to) return Number(Number(amount).toFixed(2));

  // Request the latest exchange rate from the currency conversion service.
  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${from}/${to}`
  );
  const data = await response.json();

  // Surface conversion failures instead of silently using an invalid rate.
  if (!response.ok || !data.rate) {
    throw new Error(`Unable to convert ${from} to ${to}.`);
  }

  return Number((Number(amount) * Number(data.rate)).toFixed(2));
};

// Validate and normalize an optional list of products supplied by the client.
const getRequestedItems = (items) => {
  // Require a non-empty list with a bounded number of items.
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    return null;
  }

  const normalizedItems = [];
  const seenItems = new Set();

  // Validate each product type, ID, and quantity, and reject duplicates.
  for (const item of items) {
    const itemType = item?.item_type;
    const productId = Number(item?.product_id);
    const quantity = Number(item?.quantity);

    if (
      !["gemstone", "jewellery"].includes(itemType) ||
      !Number.isSafeInteger(productId) ||
      productId < 1 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    ) {
      return null;
    }

    const key = `${itemType}:${productId}`;
    if (seenItems.has(key)) return null;
    seenItems.add(key);
    normalizedItems.push({ itemType, productId, quantity });
  }

  return normalizedItems;
};

// Fetch an available product and lock its row while checkout is in progress.
const fetchProduct = async (connection, item) => {
  // Select table and column names based on the requested inventory type.
  const isJewellery = item.itemType === "jewellery";
  const table = isJewellery ? "jewellery" : "gemstones";
  const nameColumn = isJewellery ? "product_name" : "name";
  const stockColumn = "stock_quantity";
  const currencyColumn = isJewellery ? "currency" : "'USD'";
  const availabilityCondition = isJewellery
    ? "LOWER(status) IN ('active', 'approved', 'out_of_stock')"
    : "status = 1 AND approval_status = 'approved'";

  // Load the product details needed to price and fulfill this order item.
  const [rows] = await connection.query(
    `SELECT
       id,
       ${nameColumn} AS name,
       price,
       ${currencyColumn} AS currency,
       ${stockColumn} AS stock_quantity,
       offer_rate,
       DATE_FORMAT(offer_start_date, '%Y-%m-%d') AS offer_start_date,
       DATE_FORMAT(offer_end_date, '%Y-%m-%d') AS offer_end_date,
       ${isJewellery ? "image_url" : "NULL"} AS image_url,
       ${isJewellery ? "NULL" : "carat"} AS carat,
       ${isJewellery ? "NULL" : "cut"} AS cut,
       ${isJewellery ? "NULL" : "shape"} AS shape,
       ${isJewellery ? "NULL" : "origin"} AS origin
     FROM ${table}
     WHERE id = ? AND ${availabilityCondition}
     FOR UPDATE`,
    [item.productId]
  );

  return rows[0] || null;
};

exports.checkout = async (req, res) => {
  // Read and normalize checkout details from the request and authenticated user.
  const { currency, shipping_address, shipping_method_id } = req.body;
  const userId = req.user?.id;
  const selectedCurrency =
    typeof currency === "string" ? currency.trim().toUpperCase() : "";
  const shippingAddress =
    typeof shipping_address === "string" ? shipping_address.trim() : "";

  // Require an authenticated user, supported currency input, and shipping address.
  if (!userId || !selectedCurrency || !shippingAddress) {
    return res.status(400).json({
      success: false,
      message: "currency and shipping_address are required"
    });
  }

  // Reject currencies that checkout and conversion do not support.
  if (!supportedCurrencies.includes(selectedCurrency)) {
    return res.status(400).json({
      success: false,
      message: "Unsupported currency",
      supported_currencies: supportedCurrencies
    });
  }

  // Validate client-supplied items when present; otherwise use the user's cart.
  const requestedItems = req.body.items === undefined
    ? null
    : getRequestedItems(req.body.items);
  if (req.body.items !== undefined && !requestedItems) {
    return res.status(400).json({
      success: false,
      message: "Provide 1 to 100 valid, unique gemstone or jewellery items."
    });
  }

  // Normalize and validate an optional shipping method identifier.
  const shippingMethodId = shipping_method_id === undefined || shipping_method_id === null
    ? null
    : Number(shipping_method_id);
  if (
    shippingMethodId !== null &&
    (!Number.isSafeInteger(shippingMethodId) || shippingMethodId < 1)
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid shipping_method_id is required."
    });
  }

  let connection;
  let transactionStarted = false;
  try {
    // Start a transaction so order creation and stock changes succeed together.
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Confirm the authenticated user still exists before processing the order.
    const [users] = await connection.query(
      "SELECT id FROM users WHERE id = ?",
      [userId]
    );
    if (users.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Lock and load the user's cart when no item list was supplied directly.
    let requestedCartItems = requestedItems;
    if (!requestedCartItems) {
      const [cartItems] = await connection.query(
        `SELECT gemstone_id, jewellery_id, quantity
         FROM cart
         WHERE user_id = ?
         FOR UPDATE`,
        [userId]
      );
      requestedCartItems = cartItems.map((item) => ({
        itemType: item.jewellery_id == null ? "gemstone" : "jewellery",
        productId: Number(item.jewellery_id ?? item.gemstone_id),
        quantity: Number(item.quantity)
      }));
    }

    // Reject checkout when there are no products to purchase.
    if (requestedCartItems.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // Validate cart IDs and quantities, including items loaded from the database.
    if (
      requestedCartItems.some((item) =>
        !Number.isSafeInteger(item.productId) ||
        item.productId < 1 ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1
      )
    ) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: "Your cart contains an invalid item."
      });
    }

    // Load, price, and check stock for each requested product.
    const items = [];
    for (const requestedItem of requestedCartItems) {
      const product = await fetchProduct(connection, requestedItem);
      // Stop checkout if a requested product is missing or unavailable.
      if (!product) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(404).json({
          success: false,
          message: `${requestedItem.itemType === "jewellery" ? "Jewellery" : "Gemstone"} item ${requestedItem.productId} is unavailable.`
        });
      }

      const availableStockQuantity = Number(product.stock_quantity);
      // Ensure enough inventory is available before creating the order.
      if (availableStockQuantity < requestedItem.quantity) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(409).json({
          success: false,
          message: `Insufficient stock for ${product.name}.`,
          available_stock_quantity: availableStockQuantity,
          requested_quantity: requestedItem.quantity
        });
      }

      // Apply an offer only when its rate and optional date range are valid today.
      let unitPrice = Number(product.price);
      const offerRate = Number(product.offer_rate);
      let activeDiscountRate = 0;
      const today = new Date().toISOString().slice(0, 10);
      const offerStartDate = product.offer_start_date
        ? String(product.offer_start_date).slice(0, 10)
        : null;
      const offerEndDate = product.offer_end_date
        ? String(product.offer_end_date).slice(0, 10)
        : null;
      if (
        Number.isFinite(offerRate) &&
        offerRate >= 1 &&
        offerRate <= 100 &&
        (!offerStartDate || today >= offerStartDate) &&
        (!offerEndDate || today <= offerEndDate)
      ) {
        activeDiscountRate = offerRate;
        unitPrice *= 1 - offerRate / 100;
      }

      // Validate the product price and its source currency before conversion.
      const sourceCurrency = String(product.currency || "USD").toUpperCase();
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(409).json({
          success: false,
          message: `The price for ${product.name} is invalid.`
        });
      }
      if (!supportedCurrencies.includes(sourceCurrency)) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(409).json({
          success: false,
          message: `Currency ${sourceCurrency} is not supported for ${product.name}.`
        });
      }

      // Convert current and original prices and collect item details for the order.
      items.push({
        ...requestedItem,
        name: product.name,
        price: await convertCurrency(unitPrice, sourceCurrency, selectedCurrency),
        original_price: await convertCurrency(
          Number(product.price),
          sourceCurrency,
          selectedCurrency
        ),
        discount_rate: activeDiscountRate,
        currency: selectedCurrency,
        image_url: product.image_url,
        carat: product.carat,
        cut: product.cut,
        shape: product.shape,
        origin: product.origin
      });
    }

    // Use the selected shipping method when provided; otherwise use the request cost.
    let shippingCost = Number(req.body.shipping_cost ?? 0);
    if (shippingMethodId !== null) {
      // Load and lock an active shipping method before calculating its cost.
      const [shippingMethods] = await connection.query(
        `SELECT shipping_cost, currency, free_shipping
         FROM shipping_methods
         WHERE id = ? AND status = 1
         FOR UPDATE`,
        [shippingMethodId]
      );
      // Reject a shipping method that is missing or inactive.
      if (shippingMethods.length === 0) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({
          success: false,
          message: "The selected shipping method is unavailable."
        });
      }

      // Apply free shipping or convert the method's cost to the checkout currency.
      const method = shippingMethods[0];
      shippingCost = Number(method.free_shipping)
        ? 0
        : await convertCurrency(
          Number(method.shipping_cost),
          String(method.currency || "USD").toUpperCase(),
          selectedCurrency
        );
    }

    // Reject negative, infinite, or otherwise invalid shipping charges.
    if (!Number.isFinite(shippingCost) || shippingCost < 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: "A valid shipping cost is required."
      });
    }

    // Calculate the order subtotal and generate a unique order number.
    const totalAmount = Number(
      items.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2)
    );
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create the order record with the selected address and shipping details.
    const [orderResult] = await connection.query(
      `INSERT INTO orders
       (user_id, order_number, total_amount, shipping_cost, shipping_method_id, currency,
        shipping_address, payment_status, order_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING', NOW())`,
      [
        userId,
        orderNumber,
        totalAmount,
        shippingCost,
        shippingMethodId,
        selectedCurrency,
        shippingAddress
      ]
    );
    const orderId = orderResult.insertId;

    // Save each order line and decrement its inventory within the transaction.
    for (const item of items) {
      const gemstoneId = item.itemType === "gemstone" ? item.productId : null;
      const jewelleryId = item.itemType === "jewellery" ? item.productId : null;
      await connection.query(
        `INSERT INTO order_items
         (order_id, gemstone_id, jewellery_id, quantity, price, original_price, discount_rate, currency)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          gemstoneId,
          jewelleryId,
          item.quantity,
          item.price,
          item.original_price,
          item.discount_rate,
          item.currency
        ]
      );

      // Update the matching inventory table without allowing stock to go negative.
      const table = item.itemType === "jewellery" ? "jewellery" : "gemstones";
      const stockColumn = "stock_quantity";
      const [stockUpdate] = await connection.query(
        `UPDATE ${table}
         SET ${stockColumn} = ${stockColumn} - ?
         WHERE id = ? AND ${stockColumn} >= ?`,
        [item.quantity, item.productId, item.quantity]
      );
      // Abort the transaction if inventory changed during checkout.
      if (stockUpdate.affectedRows !== 1) {
        throw new Error(`Stock changed while placing the order for ${item.name}.`);
      }
    }

    // Clear the cart and commit the completed order and stock updates.
    await connection.query("DELETE FROM cart WHERE user_id = ?", [userId]);
    await connection.commit();
    transactionStarted = false;

    // Return order totals, shipping details, and a formatted list of purchased items.
    return res.status(201).json({
      success: true,
      message: "Checkout completed successfully",
      order_id: orderId,
      order_number: orderNumber,
      total_amount: totalAmount,
      shipping_cost: shippingCost,
      final_total: Number((totalAmount + shippingCost).toFixed(2)),
      currency: selectedCurrency,
      shipping_method_id: shippingMethodId,
      items: items.map((item) => ({
        product_id: item.productId,
        item_type: item.itemType,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        original_price: item.original_price,
        discount_rate: item.discount_rate,
        currency: item.currency,
        image_url: item.image_url,
        carat: item.carat,
        cut: item.cut,
        shape: item.shape,
        origin: item.origin
      }))
    });
  } catch (error) {
    // Roll back any incomplete checkout before reporting the failure.
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    console.error("Checkout Error:", error);
    return res.status(500).json({
      success: false,
      message: "Checkout failed",
      error: error.message
    });
  } finally {
    // Release the database connection regardless of the checkout result.
    connection?.release();
  }
};
