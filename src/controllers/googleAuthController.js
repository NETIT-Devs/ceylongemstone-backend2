const jwt = require("jsonwebtoken");

const googleAuthCallback = (req, res) => {
  // Read the user authenticated by the Google OAuth middleware.
  const user = req.user;

  // Create a signed token containing the user's identity and access role.
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET || "gemstone_project_secret_key_2026",
    { expiresIn: "1d" }
  );

  // Build the frontend login URL and pass the token in its URL fragment.
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const redirectUrl = new URL("/login", frontendUrl);
  redirectUrl.hash = new URLSearchParams({ token }).toString();

  // Redirect the browser to the frontend with the authentication token.
  return res.redirect(303, redirectUrl.toString());
};

// Export the callback for the Google authentication route.
module.exports = { googleAuthCallback };
