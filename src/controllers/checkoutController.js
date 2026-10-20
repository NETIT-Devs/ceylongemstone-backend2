const db = require("../config/db");

const supportedCurrencies = ["USD", "LKR", "EUR", "GBP", "AUD", "CAD"];

const convertCurrency = async (amount, from, to) => {
  if (from === to) return Number(Number(amount).toFixed(2));

  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${from}/${to}`
  );
  const data = await response.json();

  if (!response.ok || !data.rate) {
    throw new Error(`Unable to convert ${from} to ${to}.`);
  }

  return Number((Number(amount) * Number(data.rate)).toFixed(2));
};

const getRequestedItems = (items) => {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    return null;
  }

  const normalizedItems = [];
  const seenItems = new Set();

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

const fetchProduct = async (connection, item) => {
  const isJewellery = item.itemType === "jewellery";
  const table = isJewellery ? "jewellery" : "gemstones";
  const nameColumn = isJewellery ? "product_name" : "name";
  const stockColumn = isJewellery ? "stock_quantity" : "stock";
  const currencyColumn = isJewellery ? "currency" : "'USD'";
  const availabilityCondition = isJewellery
    ? "LOWER(status) IN ('active', 'approved')"
    : "status = 1 AND approval_status = 'approved'";
  const [rows] = await connection.query(
    `SELECT
       id,
       ${nameColumn} AS name,
       price,
       ${currencyColumn} AS currency,
       ${stockColumn} AS stock,
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
  const { currency, shipping_address, shipping_method_id } = req.body;
  const userId = req.user?.id;
  const selectedCurrency =
    typeof currency === "string" ? currency.trim().toUpperCase() : "";
  const shippingAddress =
    typeof shipping_address === "string" ? shipping_address.trim() : "";

  if (!userId || !selectedCurrency || !shippingAddress) {
    return res.status(400).json({
      success: false,
      message: "currency and shipping_address are required"
    });
  }

  if (!supportedCurrencies.includes(selectedCurrency)) {
    return res.status(400).json({
      success: false,
      message: "Unsupported currency",
      supported_currencies: supportedCurrencies
    });
  }

  const requestedItems = req.body.items === undefined
    ? null
    : getRequestedItems(req.body.items);
  if (req.body.items !== undefined && !requestedItems) {
    return res.status(400).json({
      success: false,
      message: "Provide 1 to 100 valid, unique gemstone or jewellery items."
    });
  }

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
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [users] = await connection.query(
      "SELECT id FROM users WHERE id = ?",
      [userId]
    );
    if (users.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ success: false, message: "User not found" });
    }

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

    if (requestedCartItems.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

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

    const items = [];
    for (const requestedItem of requestedCartItems) {
      const product = await fetchProduct(connection, requestedItem);
      if (!product) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(404).json({
          success: false,
          message: `${requestedItem.itemType === "jewellery" ? "Jewellery" : "Gemstone"} item ${requestedItem.productId} is unavailable.`
        });
      }

      const availableStock = Number(product.stock);
      if (availableStock < requestedItem.quantity) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(409).json({
          success: false,
          message: `Insufficient stock for ${product.name}.`,
          available_stock: availableStock,
          requested_quantity: requestedItem.quantity
        });
      }

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

    let shippingCost = Number(req.body.shipping_cost ?? 0);
    if (shippingMethodId !== null) {
      const [shippingMethods] = await connection.query(
        `SELECT shipping_cost, currency, free_shipping
         FROM shipping_methods
         WHERE id = ? AND status = 1
         FOR UPDATE`,
        [shippingMethodId]
      );
      if (shippingMethods.length === 0) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({
          success: false,
          message: "The selected shipping method is unavailable."
        });
      }

      const method = shippingMethods[0];
      shippingCost = Number(method.free_shipping)
        ? 0
        : await convertCurrency(
          Number(method.shipping_cost),
          String(method.currency || "USD").toUpperCase(),
          selectedCurrency
        );
    }

    if (!Number.isFinite(shippingCost) || shippingCost < 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: "A valid shipping cost is required."
      });
    }

    const totalAmount = Number(
      items.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2)
    );
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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

      const table = item.itemType === "jewellery" ? "jewellery" : "gemstones";
      const stockColumn = item.itemType === "jewellery" ? "stock_quantity" : "stock";
      const [stockUpdate] = await connection.query(
        `UPDATE ${table}
         SET ${stockColumn} = ${stockColumn} - ?
         WHERE id = ? AND ${stockColumn} >= ?`,
        [item.quantity, item.productId, item.quantity]
      );
      if (stockUpdate.affectedRows !== 1) {
        throw new Error(`Stock changed while placing the order for ${item.name}.`);
      }
    }

    await connection.query("DELETE FROM cart WHERE user_id = ?", [userId]);
    await connection.commit();
    transactionStarted = false;

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
    connection?.release();
  }
};
