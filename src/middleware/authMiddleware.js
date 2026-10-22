const jwt = require("jsonwebtoken");

// Verify the request's bearer token and attach its claims to the request.
const verifyToken = (req, res, next) => {
  try {
    // Require the Authorization header to use the Bearer token format.
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access token is missing or invalid format (expected: Bearer <token>)"
      });
    }

    // Extract and verify the token, then make the decoded user available to routes.
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "gemstone_project_secret_key_2026");
    req.user = decoded;

    // Continue to the next middleware or route after successful verification.
    next();
  } catch (error) {
    // Reject tokens that are invalid, expired, or otherwise fail verification.
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
      error: error.message
    });
  }
};

// Restrict access to administrators and super administrators.
const requireAdmin = (req, res, next) => {
  // Normalize the role before checking the allowed admin roles.
  const role = String(req.user?.role || "").toUpperCase();
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Access forbidden: Admin privileges required"
    });
  }

  // Continue when the authenticated user has an allowed admin role.
  next();
};

// Restrict access to super administrators only.
const requireSuperAdmin = (req, res, next) => {
  // Normalize and check the authenticated user's role.
  if (String(req.user?.role || "").toUpperCase() !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Access forbidden: Super Admin privileges required"
    });
  }

  // Continue when the authenticated user is a super administrator.
  next();
};

// Export the authentication and role-check middleware.
module.exports = {
  verifyToken,
  requireAdmin,
  requireSuperAdmin
};
