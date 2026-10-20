const jwt = require("jsonwebtoken");

const googleAuthCallback = (req, res) => {
  const user = req.user;
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET || "gemstone_project_secret_key_2026",
    { expiresIn: "1d" }
  );

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const redirectUrl = new URL("/login", frontendUrl);
  redirectUrl.hash = new URLSearchParams({ token }).toString();

  return res.redirect(303, redirectUrl.toString());
};

module.exports = { googleAuthCallback };
