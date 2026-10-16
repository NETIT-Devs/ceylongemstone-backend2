const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access token is missing or invalid format (expected: Bearer <token>)"
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "gemstone_project_secret_key_2026");
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
      error: error.message
    });
  }
};

const requireAdmin = (req, res, next) => {
  const role = String(req.user?.role || "").toUpperCase();
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Access forbidden: Admin privileges required"
    });
  }
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (String(req.user?.role || "").toUpperCase() !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Access forbidden: Super Admin privileges required"
    });
  }
  next();
};

module.exports = {
  verifyToken,
  requireAdmin,
  requireSuperAdmin
};
