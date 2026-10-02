require("dotenv").config();
const db = require("../config/db");
const bcrypt = require("bcryptjs");

async function seedDatabase() {
  console.log("--- Starting Database Seeder ---");

  try {
    // 1. Seed Categories
    console.log("Checking categories...");
    const [existingCategories] = await db.query("SELECT COUNT(*) AS count FROM categories");
    
    if (existingCategories[0].count === 0) {
      console.log("Seeding categories...");
      const categories = [
        { name: "Sapphire", description: "Natural Ceylon Sapphires including Blue, Yellow, and Padparadscha" },
        { name: "Ruby", description: "Natural Sri Lankan Rubies and Star Rubies" },
        { name: "Emerald", description: "Premium grade natural Emeralds" },
        { name: "Alexandrite", description: "Rare color-changing Chrysoberyl Alexandrite" },
        { name: "Spinel", description: "Natural untreated Ceylon Spinels" }
      ];

      for (const cat of categories) {
        await db.query(
          "INSERT INTO categories (name, description, status) VALUES (?, ?, 1)",
          [cat.name, cat.description]
        );
      }
      console.log(`Successfully seeded ${categories.length} categories.`);
    } else {
      console.log(`Categories already exist (${existingCategories[0].count} found).`);
    }

    // 2. Seed Test / Admin User
    console.log("Checking users...");
    const [testUsers] = await db.query("SELECT id FROM users WHERE email = ?", ["test@test.com"]);

    if (testUsers.length === 0) {
      console.log("Creating default user test@test.com (password: test)...");
      const hashedPassword = await bcrypt.hash("test", 10);
      await db.query(
        "INSERT INTO users (name, email, password, role, phone, address, status) VALUES (?, ?, ?, ?, ?, ?, 1)",
        ["Test Admin", "test@test.com", hashedPassword, "ADMIN", "+94771234567", "Colombo, Sri Lanka"]
      );
      console.log("Default user created successfully.");
    } else {
      console.log("User test@test.com already exists.");
    }

    // 3. Seed Sample Gemstones if empty
    const [existingGemstones] = await db.query("SELECT COUNT(*) AS count FROM gemstones");
    if (existingGemstones[0].count === 0) {
      console.log("Seeding sample gemstone...");
      const [firstCategory] = await db.query("SELECT id FROM categories LIMIT 1");
      const categoryId = firstCategory[0]?.id || 1;

      await db.query(
        `INSERT INTO gemstones 
        (gemstone_id, category_id, name, color, carat, length, width, height, clarity, cut, shape, origin, treatment_status, price, stock, description, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "GEM-1001",
          categoryId,
          "Royal Blue Ceylon Sapphire",
          "Royal Blue",
          3.45,
          8.5,
          7.2,
          5.1,
          "VVS1",
          "Faceted",
          "Oval",
          "Ratnapura, Sri Lanka",
          "Unheated",
          4500.00,
          1,
          "Certified natural Royal Blue Ceylon Sapphire with exceptional brilliance and clarity.",
          1
        ]
      );
      console.log("Sample gemstone seeded successfully.");
    } else {
      console.log(`Gemstones already exist (${existingGemstones[0].count} found).`);
    }

    console.log("--- Database Seeding Complete! ---");
  } catch (error) {
    console.error("Seeding Error:", error);
  } finally {
    process.exit(0);
  }
}

seedDatabase();
