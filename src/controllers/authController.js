const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ==========================================
// User Registration
// ==========================================
const register = async (req, res) => {
  try {
    const { name, email, password, phone, address, role } = req.body;

    // Required fields validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required"
      });
    }

    // Check existing user
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // ==========================================
    // Role Handling
    // ==========================================

    const requestedRole = role
      ? role.toUpperCase()
      : "CUSTOMER";

    // Public registration only allows CUSTOMER and ADMIN
    // SUPER_ADMIN cannot be created through public registration
    if (!["CUSTOMER", "ADMIN"].includes(requestedRole)) {
      return res.status(403).json({
        success: false,
        message:
          "SUPER_ADMIN accounts cannot be created through public registration"
      });
    }

    // ==========================================
    // Approval Status
    // ==========================================

    // Customer -> Approved immediately
    // Admin -> Waiting for Super Admin approval
    const approvalStatus =
      requestedRole === "ADMIN"
        ? "PENDING"
        : "APPROVED";

    // ==========================================
    // Create User
    // ==========================================

    const [result] = await db.query(
      `INSERT INTO users
      (
        name,
        email,
        password,
        role,
        approval_status,
        phone,
        address,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        name,
        email,
        hashedPassword,
        requestedRole,
        approvalStatus,
        phone || null,
        address || null
      ]
    );

    const newUserId = result.insertId;

    // ==========================================
    // ADMIN Registration
    // ==========================================

    // Admin must wait for Super Admin approval
    if (requestedRole === "ADMIN") {
      return res.status(201).json({
        success: true,
        message:
          "Admin registration submitted. Waiting for Super Admin approval.",
        user: {
          id: newUserId,
          name,
          email,
          role: requestedRole,
          approval_status: approvalStatus,
          phone: phone || null,
          address: address || null,
          status: 1
        }
      });
    }

    // ==========================================
    // CUSTOMER Registration
    // ==========================================

    // Customer can login immediately
    const token = jwt.sign(
      {
        id: newUserId,
        email,
        role: requestedRole
      },
      process.env.JWT_SECRET ||
      "gemstone_project_secret_key_2026",
      {
        expiresIn: "1d"
      }
    );

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: newUserId,
        name,
        email,
        role: requestedRole,
        approval_status: approvalStatus,
        phone: phone || null,
        address: address || null,
        status: 1
      }
    });

  } catch (error) {
    console.error("Register Error:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message
    });
  }
};

const createAdminUser = async (req, res) => {
  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Only Super Administrators can create admin accounts"
    });
  }

  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const phone = typeof req.body.phone === "string" ? req.body.phone.trim() : "";

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Name, email, and temporary password are required"
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Temporary password must be at least 6 characters long"
    });
  }

  try {
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "A user with this email address already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO users
        (name, email, password, role, approval_status, phone, status)
       VALUES (?, ?, ?, 'ADMIN', 'APPROVED', ?, 1)`,
      [name, email, hashedPassword, phone || null]
    );

    return res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      user: {
        id: result.insertId,
        name,
        email,
        role: "ADMIN",
        approval_status: "APPROVED",
        phone: phone || null,
        status: 1
      }
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A user with this email address already exists"
      });
    }

    console.error("Create Admin User Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create admin account",
      error: error.message
    });
  }
};


// ==========================================
// User Login
// ==========================================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Required fields validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Find user
    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const user = rows[0];

    // ==========================================
    // Check Account Status
    // ==========================================

    if (Number(user.status) === 0) {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended"
      });
    }

    if (Number(user.status) !== 1) {
      return res.status(403).json({
        success: false,
        message:
          "Account is disabled. Please contact administrator."
      });
    }

    // ==========================================
    // Check ADMIN Approval
    // ==========================================

    if (
      user.role === "ADMIN" &&
      user.approval_status !== "APPROVED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          `Admin account is ${user.approval_status.toLowerCase()}. Waiting for Super Admin approval.`
      });
    }

    // ==========================================
    // Check Password
    // ==========================================

    const isPasswordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // ==========================================
    // Create JWT Token
    // ==========================================

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET ||
      "gemstone_project_secret_key_2026",
      {
        expiresIn: "1d"
      }
    );

    // ==========================================
    // Login Success
    // ==========================================

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        approval_status: user.approval_status,
        phone: user.phone,
        address: user.address,
        status: user.status
      }
    });

  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message
    });
  }
};


// ==========================================
// Get Current User Profile
// ==========================================
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      `SELECT
        id,
        name,
        email,
        role,
        approval_status,
        phone,
        address,
        status,
        created_at
      FROM users
      WHERE id = ?`,
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      user: rows[0]
    });

  } catch (error) {
    console.error("Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: error.message
    });
  }
};

const deleteAdminUser = async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid admin user ID is required"
    });
  }

  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Only Super Administrators can remove admin accounts"
    });
  }

  if (Number(req.user.id) === userId) {
    return res.status(403).json({
      success: false,
      message: "You cannot remove your own account"
    });
  }

  try {
    const [result] = await db.query(
      "DELETE FROM users WHERE id = ? AND role = 'ADMIN'",
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin account not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Admin account deleted successfully",
      id: userId
    });
  } catch (error) {
    console.error("Delete Admin User Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete admin account",
      error: error.message
    });
  }
};

const updateAdminUserStatus = async (req, res) => {
  const userId = Number(req.params.id);
  const status = Number(req.body.status);

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid admin user ID is required"
    });
  }

  if (status !== 0 && status !== 1) {
    return res.status(400).json({
      success: false,
      message: "Admin account status must be 0 or 1"
    });
  }

  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Only Super Administrators can modify admin accounts"
    });
  }

  if (Number(req.user.id) === userId) {
    return res.status(403).json({
      success: false,
      message: "You cannot suspend your own active administrative session"
    });
  }

  try {
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE id = ? AND role = 'ADMIN'",
      [userId]
    );

    if (!existingUsers.length) {
      return res.status(404).json({
        success: false,
        message: "Admin account not found"
      });
    }

    await db.query(
      "UPDATE users SET status = ? WHERE id = ? AND role = 'ADMIN'",
      [status, userId]
    );

    return res.status(200).json({
      success: true,
      message: status === 0 ? "Admin account suspended" : "Admin account activated",
      id: userId,
      status
    });
  } catch (error) {
    console.error("Update Admin User Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update admin account status",
      error: error.message
    });
  }
};


// ==========================================
// Export Controllers
// ==========================================
module.exports = {
  register,
  createAdminUser,
  login,
  getProfile,
  deleteAdminUser,
  updateAdminUserStatus
};