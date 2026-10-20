const db = require("../config/db");

const LOW_STOCK_THRESHOLD = 3;
const isValidDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

exports.getDashboardStats = async (req, res) => {
  const { startDate, endDate } = req.query;

  if ((startDate && !isValidDate(startDate)) || (endDate && !isValidDate(endDate))) {
    return res.status(400).json({
      success: false,
      message: "startDate and endDate must be valid dates in YYYY-MM-DD format."
    });
  }

  if (startDate && endDate && startDate > endDate) {
    return res.status(400).json({
      success: false,
      message: "startDate must be on or before endDate."
    });
  }

  const dateConditions = [];
  const dateParams = [];

  if (startDate) {
    dateConditions.push("created_at >= ?");
    dateParams.push(startDate);
  }
  if (endDate) {
    dateConditions.push("created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    dateParams.push(endDate);
  }
  const dateFilter = dateConditions.length
    ? ` AND ${dateConditions.join(" AND ")}`
    : "";

  try {
    const [[gemstoneCounts], [jewelleryCounts], [orderCounts], [shipmentCounts]] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS active_count
         FROM gemstones
         WHERE status = 1`
      ),
      db.query(
        `SELECT COUNT(*) AS active_count
         FROM jewellery
         WHERE LOWER(status) IN ('active', 'approved')`
      ),
      db.query(
        `SELECT COUNT(*) AS total_orders
         FROM orders
         WHERE 1 = 1${dateFilter}`,
        dateParams
      ),
      db.query(
        `SELECT COUNT(*) AS in_transit_count
         FROM orders
         WHERE UPPER(order_status) IN ('DISPATCHED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY')${dateFilter}`,
        dateParams
      )
    ]);

    const activeGemstones = Number(gemstoneCounts[0]?.active_count || 0);
    const activeJewellery = Number(jewelleryCounts[0]?.active_count || 0);

    return res.status(200).json({
      success: true,
      data: {
        active_gemstones: activeGemstones,
        active_jewellery: activeJewellery,
        active_inventory: activeGemstones + activeJewellery,
        total_orders: Number(orderCounts[0]?.total_orders || 0),
        shipments_in_transit: Number(shipmentCounts[0]?.in_transit_count || 0)
      }
    });
  } catch (error) {
    console.error("Get Dashboard Stats Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message
    });
  }
};

exports.getLowStockItems = async (req, res) => {
  try {
    const [gemstones, jewellery] = await Promise.all([
      db.query(
        `SELECT
           'gemstone' AS item_type,
           g.id,
           g.gemstone_id AS item_code,
           g.name AS item_name,
           g.stock AS quantity,
           g.price,
           c.name AS category,
           (SELECT gi.image_url
            FROM gemstone_images gi
            WHERE gi.gemstone_id = g.id
            ORDER BY gi.is_primary DESC, gi.id ASC
            LIMIT 1) AS image_url
         FROM gemstones g
         LEFT JOIN categories c ON c.id = g.category_id
         WHERE g.stock <= ?`,
        [LOW_STOCK_THRESHOLD]
      ),
      db.query(
        `SELECT
           'jewellery' AS item_type,
           j.id,
           j.product_code AS item_code,
           j.product_name AS item_name,
           j.stock_quantity AS quantity,
           j.price,
           j.jewellery_type AS category,
           j.image_url
         FROM jewellery j
         WHERE j.stock_quantity <= ?`,
        [LOW_STOCK_THRESHOLD]
      )
    ]);

    const items = [...gemstones[0], ...jewellery[0]]
      .sort((a, b) => Number(a.quantity) - Number(b.quantity));

    return res.status(200).json({
      success: true,
      threshold: LOW_STOCK_THRESHOLD,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error("Get Low Stock Items Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch low-stock inventory",
      error: error.message
    });
  }
};

exports.addStock = async (req, res) => {
  const { type, id } = req.params;
  const quantity = Number(req.body?.quantity);
  const itemId = Number(id);
  const inventory = {
    gemstone: { table: "gemstones", stockColumn: "stock" },
    jewellery: { table: "jewellery", stockColumn: "stock_quantity" }
  }[type];

  if (!inventory || !Number.isSafeInteger(itemId) || itemId < 1) {
    return res.status(400).json({
      success: false,
      message: "A valid inventory item type and ID are required."
    });
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return res.status(400).json({
      success: false,
      message: "Quantity to add must be a positive whole number."
    });
  }

  try {
    const [result] = await db.query(
      `UPDATE ${inventory.table}
       SET ${inventory.stockColumn} = ${inventory.stockColumn} + ?
       WHERE id = ?`,
      [quantity, itemId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found."
      });
    }

    const [[item]] = await db.query(
      `SELECT ${inventory.stockColumn} AS quantity
       FROM ${inventory.table}
       WHERE id = ?`,
      [itemId]
    );

    return res.status(200).json({
      success: true,
      message: "Inventory stock updated successfully.",
      data: { item_type: type, id: itemId, quantity: Number(item.quantity) }
    });
  } catch (error) {
    console.error("Add Inventory Stock Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update inventory stock.",
      error: error.message
    });
  }
};
