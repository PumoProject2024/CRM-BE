const jwt = require("jsonwebtoken");
const studentAuthMiddleware = require("./studentAuthMiddleware");
const authMiddleware = require("./authMiddleware");

const studentOrStaffAuthMiddleware = (req, res, next) => {

  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided"
    });
  }

  const token = authHeader.split(" ")[1];

  try {

    // decode without verifying to check payload structure
    const decoded = jwt.decode(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    }

    // ✅ if token contains studentId → student
    if (decoded.studentId) {
      return studentAuthMiddleware(req, res, next);
    }

    // ✅ if token contains emp_id → staff
    if (decoded.emp_id) {
      return authMiddleware(req, res, next);
    }

    return res.status(403).json({
      success: false,
      message: "Unknown token type"
    });

  } catch (err) {

    console.error("Auth detection error:", err);

    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });

  }

};

module.exports = studentOrStaffAuthMiddleware;