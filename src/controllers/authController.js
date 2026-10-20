const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const forgotPassword = async (req, res) => {
  const email = typeof req.body?.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: "A valid email address is required"
    });
  }

  try {
    const [users] = await db.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "No account was found with that email address"
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const [updateResult] = await db.execute(
      `UPDATE users
       SET password_reset_token = ?,
           password_reset_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR)
       WHERE id = ?`,
      [tokenHash, users[0].id]
    );

    if (updateResult.affectedRows !== 1) {
      throw new Error("Password reset token was not saved for the matching user");
    }

    const [updatedUsers] = await db.execute(
      `SELECT password_reset_expires
       FROM users
       WHERE id = ? AND password_reset_token = ?
       LIMIT 1`,
      [users[0].id, tokenHash]
    );

    if (!updatedUsers.length) {
      throw new Error("Saved password reset token could not be verified");
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = new URL("/reset-password", frontendUrl);
    resetUrl.searchParams.set("token", token);

    return res.status(200).json({
      success: true,
      message: "Password reset link generated successfully",
      resetLink: resetUrl.toString(),
      expiresAt: updatedUsers[0].password_reset_expires
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to generate a password reset link"
    });
  }
};

const resetPassword = async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({
      success: false,
      message: "A valid password reset token is required"
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters long"
    });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [users] = await db.query(
      `SELECT id
       FROM users
       WHERE password_reset_token = ?
         AND password_reset_expires > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (!users.length) {
      return res.status(400).json({
        success: false,
        message: "Password reset token is invalid or expired"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `UPDATE users
       SET password = ?, password_reset_token = NULL, password_reset_expires = NULL
       WHERE id = ?
         AND password_reset_token = ?
         AND password_reset_expires > NOW()`,
      [hashedPassword, users[0].id, tokenHash]
    );

    if (result.affectedRows !== 1) {
      return res.status(400).json({
        success: false,
        message: "Password reset token is invalid or expired"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully"
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to reset password"
    });
  }
};

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

const getAdminUsers = async (req, res) => {
  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Only Super Administrators can view admin accounts"
    });
  }

  try {
    const [users] = await db.query(
      `SELECT id, name, email, role, approval_status, phone, status, created_at
       FROM users
       WHERE role = 'ADMIN'
       ORDER BY created_at DESC, id DESC`
    );

    return res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error("Get Admin Users Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin accounts",
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
  forgotPassword,
  resetPassword,
  register,
  createAdminUser,
  getAdminUsers,
  login,
  getProfile,
  deleteAdminUser,
  updateAdminUserStatus
};