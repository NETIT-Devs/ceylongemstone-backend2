const db = require("../config/db");

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM categories ORDER BY id ASC");
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("Fetch Categories Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message
    });
  }
};

// Get single category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT * FROM categories WHERE id = ?", [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error("Fetch Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching category",
      error: error.message
    });
  }
};

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const { name, description, image, status } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required"
      });
    }

    const categoryStatus = status === undefined || status === 1 || status === true || status === "active" ? 1 : 0;

    const [result] = await db.query(
      "INSERT INTO categories (name, description, image, status) VALUES (?, ?, ?, ?)",
      [name, description || null, image || null, categoryStatus]
    );

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      categoryId: result.insertId
    });
  } catch (error) {
    console.error("Create Category Error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A category with this name already exists"
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: error.message
    });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, status } = req.body;

    // Check category
    const [existing] = await db.query(
      "SELECT * FROM categories WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    // Check duplicate name
    if (name) {
      const [duplicate] = await db.query(
        "SELECT id FROM categories WHERE name = ? AND id != ?",
        [name, id]
      );

      if (duplicate.length > 0) {
        return res.status(409).json({
          success: false,
          message: "A category with this name already exists"
        });
      }
    }

    const categoryStatus =
      status === undefined
        ? existing[0].status
        : (status === 1 ||
           status === true ||
           status === "1" ||
           status === "active" ? 1 : 0);

    await db.query(
      `UPDATE categories
       SET name = ?,
           description = ?,
           image = ?,
           status = ?
       WHERE id = ?`,
      [
        name || existing[0].name,
        description !== undefined ? description : existing[0].description,
        image !== undefined ? image : existing[0].image,
        categoryStatus,
        id
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Category updated successfully"
    });

  } catch (error) {
    console.error("Update Category Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message
    });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check category exists
    const [category] = await db.query(
      "SELECT * FROM categories WHERE id = ?",
      [id]
    );

    if (category.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    // Check if gemstones are using this category
    const [gemstones] = await db.query(
      "SELECT id FROM gemstones WHERE category_id = ? LIMIT 1",
      [id]
    );

    if (gemstones.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete category because gemstones are using it"
      });
    }

    await db.query(
      "DELETE FROM categories WHERE id = ?",
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully"
    });

  } catch (error) {
    console.error("Delete Category Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: error.message
    });
  }
};
