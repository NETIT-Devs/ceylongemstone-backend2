const db = require("../src/config/db");

async function run() {
  try {
    console.log("Applying migration to jewellery table status...");
    await db.query(`
      ALTER TABLE jewellery 
      MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending'
    `);
    console.log("Migration applied successfully!");
    const [cols] = await db.query("DESCRIBE jewellery");
    console.log("Current schema for status:", cols.find(c => c.Field === "status"));
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

run();
