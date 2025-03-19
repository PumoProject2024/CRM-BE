const jwt = require("jsonwebtoken");
require("dotenv").config();

const authMiddleware = (req, res, next) => {
  try {
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
    const { emp_id, branch, role } = decoded;
    if (!emp_id || !branch || !role) {
      return res.status(403).json({ message: "Invalid Token: Missing user details." });
    }

    // ✅ Ensure branch is an array (normalize the structure)
    req.user = {
      ...decoded,
      branch: Array.isArray(branch) ? branch : [branch],
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
