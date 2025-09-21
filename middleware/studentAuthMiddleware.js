const jwt = require("jsonwebtoken");
require("dotenv").config();

const studentAuthMiddleware = (req, res, next) => {
  try {
    console.log("Student Auth - Incoming Request: ", req.method, req.originalUrl);

    // ✅ Bypass auth for public routes
    const publicRoutes = ['/logined', '/setup-password', '/register'];
    if (publicRoutes.includes(req.originalUrl)) {
      return next();
    }

    // ✅ Extract the Authorization header
    const authHeader = req.header("Authorization");
    console.log("Student Auth - Authorization Header: ", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false,
        message: "Access Denied. No token provided." 
      });
    }

    // ✅ Extract and verify the JWT token
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Student Auth - Decoded Token: ", decoded);

    // ✅ Validate required fields in the student token
    const { studentId, name, email_Id, course, courseType } = decoded;
    if (!studentId || !name || !email_Id) {
      return res.status(403).json({ 
        success: false,
        message: "Invalid Token: Missing student details." 
      });
    }

    // ✅ Attach student info to request object
    req.student = {
      studentId,
      name,
      email_Id,
      course,
      courseType,
      // Add any other student-specific fields you need
    };

    next(); // Pass control to the next middleware
  } catch (error) {
    console.error("Student JWT Verification Error:", error);

    const statusCode = error.name === "TokenExpiredError" ? 401 : 403;
    res.status(statusCode).json({
      success: false,
      message: "Invalid or Expired Token",
      error: error.message,
    });
  }
};

module.exports = studentAuthMiddleware;