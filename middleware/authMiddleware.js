const jwt = require("jsonwebtoken");
require("dotenv").config();

const authMiddleware = (req, res, next) => {
  try {
    console.log("Incoming Request: ", req.method, req.originalUrl);

    // ✅ Bypass auth for public routes (like /register)
    if (req.originalUrl === "/register") {
      return next(); // Allow access without token
    }

    // ✅ Extract the Authorization header
    const authHeader = req.header("Authorization");
    console.log("Incoming Request: ", req.method, req.originalUrl);
    console.log("Authorization Header: ", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Access Denied. No token provided." });
    }

    // ✅ Extract and verify the JWT token
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded Token: ", decoded);

    // ✅ Validate required fields in the token
    const { emp_id, branch, role, emp_name, has_access,contact_num } = decoded; // ✅ include has_access
    if (!emp_id || !branch || !role || !emp_name) {
      return res.status(403).json({ message: "Invalid Token: Missing user details." });
    }

    // ✅ Ensure branch is an array (normalize the structure)
    req.user = {
      emp_id,
      branch: Array.isArray(branch) ? branch : [branch],
      role,
      emp_name, // Ensure name is passed forward
      has_access, // ✅ pass this too
      contact_num,

    };

    next(); // Pass control to the next middleware
  } catch (error) {
    console.error("JWT Verification Error:", error);

    const statusCode = error.name === "TokenExpiredError" ? 401 : 403;
    res.status(statusCode).json({
      message: "Invalid or Expired Token",
      error: error.message,
    });
  }
};

module.exports = authMiddleware;
