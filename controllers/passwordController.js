const Employee = require("../models/Employee");
const StudentRegistration = require("../models/studenReg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Op } = require('sequelize');
const sgMail = require("@sendgrid/mail");

// ─────────────────────────────────────────────────────────────────────────────
// Helper: find user from either Employee or Student table by email
// Returns { user, type } where type is "employee" or "student"
// ─────────────────────────────────────────────────────────────────────────────
const findUserByEmail = async (email) => {
  const employee = await Employee.findOne({ where: { email_id: email } });
  if (employee) return { user: employee, type: "employee" };

  const student = await StudentRegistration.findOne({ where: { email_Id: email } });
  if (student) return { user: student, type: "student" };

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: find user from either table by id + valid reset token
// ─────────────────────────────────────────────────────────────────────────────
const findUserByIdAndToken = async (id, userType) => {
  const condition = {
    reset_token: { [Op.ne]: null },
    reset_token_expires: { [Op.gt]: new Date() },
  };

  if (userType === "employee") {
    return await Employee.findOne({ where: { emp_id: id, ...condition } });
  } else if (userType === "student") {
    return await StudentRegistration.findOne({ where: { id, ...condition } });
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Request Password Reset
// POST /api/auth/request-reset
// Body: { email }
// ─────────────────────────────────────────────────────────────────────────────
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email_id } = req.body;
    const email = email_id;
    // Check employee table first, then student table
    const found = await findUserByEmail(email);

    if (!found) {
      return res.status(404).json({ message: "No account found with that email" });
    }

    const { user, type } = found;

    // Generate raw reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Hash token for secure storage
    const hashedToken = await bcrypt.hash(resetToken, 10);

    const tokenData = {
      reset_token: hashedToken,
      reset_token_expires: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    };

    // Determine primary key and reset URL based on user type
    let userId, resetUrl;

    if (type === "employee") {
      userId = user.emp_id;
      await Employee.update(tokenData, { where: { emp_id: userId } });
      resetUrl = `${process.env.FRONTEND_URL}/password/reset/${type}/${userId}/${resetToken}`;
    } else {
      userId = user.id;
      await StudentRegistration.update(tokenData, { where: { id: userId } });
      resetUrl = `${process.env.FRONTEND_URL}/password/reset/${type}/${userId}/${resetToken}`;
    }

    // ✅ DEVELOPMENT LOGGING
    console.log(`🔐 Password Reset Token Generated [${type.toUpperCase()}]:`);
    console.log("ID:", userId);
    console.log("Raw Token (for Postman):", resetToken);
    console.log("Reset URL:", resetUrl);

    // Send reset email
    const msg = {
      to: email,
      from: process.env.EMAIL_FROM,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Password Reset Request</h2>
          <p>Hello ${user.name || "User"},</p>
          <p>You requested a password reset.</p>
          <p>This link is valid for <strong>5 minutes</strong>:</p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:10px 20px;background:#4CAF50;color:#fff;text-decoration:none;border-radius:5px;">
             Reset Password
          </a>
          <p>If you didn't request this, ignore this email.</p>
          <br/>
          <p>Pumo Technovation Team</p>
        </div>
      `,
    };

    await sgMail.send(msg);

    res.status(200).json({
      message: "Password reset link sent to your email",
      success: true,
      userType: type,       // "employee" or "student"
      userId,
      resetToken,           // raw token (remove in production)
      resetUrl,             // full reset URL (remove in production)
    });

  } catch (error) {
    console.error("Password reset request error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Verify Reset Token
// GET /api/auth/verify-token/:userType/:id/:token
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyResetToken = async (req, res) => {
  try {
    const { userType, id, token } = req.params;

    if (!["employee", "student"].includes(userType)) {
      return res.status(400).json({ message: "Invalid user type" });
    }

    const user = await findUserByIdAndToken(id, userType);

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const isValidToken = await bcrypt.compare(token, user.reset_token);

    if (!isValidToken) {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    res.status(200).json({ message: "Token verified, proceed to reset password" });

  } catch (error) {
    console.error("Token verification error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Reset Password
// POST /api/auth/reset-password
// Body: { userType, id, token, newPassword }
// ─────────────────────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { userType, id, token, newPassword } = req.body;

    if (!["employee", "student"].includes(userType)) {
      return res.status(400).json({ message: "Invalid user type" });
    }

    const user = await findUserByIdAndToken(id, userType);

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const isValidToken = await bcrypt.compare(token, user.reset_token);

    if (!isValidToken) {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const clearedTokenData = {
      password: hashedPassword,
      reset_token: null,
      reset_token_expires: null,
    };

    // Update correct table
    if (userType === "employee") {
      await Employee.update(clearedTokenData, { where: { emp_id: user.emp_id } });
    } else {
      await StudentRegistration.update(clearedTokenData, { where: { id: user.id } });
    }

    // Get the correct email field based on user type
    const userEmail = userType === "employee" ? user.email_id : user.email_Id;

    // Send confirmation email
    await sgMail.send({
      to: userEmail,
      from: process.env.EMAIL_FROM,
      subject: "Password Reset Successful",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Password Reset Successful</h2>
          <p>Hello ${user.name || "User"},</p>
          <p>Your password has been changed successfully.</p>
          <p>If this wasn't you, contact support immediately.</p>
          <br/>
          <p>Pumo Technovation Team</p>
        </div>
      `,
    });

    res.status(200).json({ message: "Password has been reset successfully" });

  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Admin-only: Reset to default password
exports.resetToDefaultPassword = async (req, res) => {
  try {
    const { email_id } = req.body;

    // Ensure only Super-Admin can call this
    if (req.user.role !== "Super-Admin") {
      return res.status(403).json({ message: "Forbidden: Super-Admins only" });
    }

    const employee = await Employee.findOne({ where: { email_id } });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const defaultPassword = "Pumo@123"; // Default password
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await Employee.update(
      {
        password: hashedPassword,
        reset_token: null,
        reset_token_expires: null,
        force_password_change: true // Optional flag
      },
      { where: { email_id } }
    );

    res.status(200).json({
      message: "Password reset to default successfully",
      email_id,
      defaultPassword // Optional: return for testing/debug
    });

  } catch (error) {
    console.error("Default password reset error:", error);
    res.status(500).json({ error: error.message });
  }
};

