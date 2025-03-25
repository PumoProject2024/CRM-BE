const Employee = require("../models/Employee");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Op } = require('sequelize');
const nodemailer = require("nodemailer");

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail", // e.g., "gmail"
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Request password reset
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email_id } = req.body;
    
    // Check if employee exists
    const employee = await Employee.findOne({ where: { email_id } });
    
    if (!employee) {
      return res.status(404).json({ message: "No account found with that email" });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash the reset token for storage
    const hashedToken = await bcrypt.hash(resetToken, 10);
    
    // Set token and expiry in database
    await Employee.update(
      { 
        reset_token: hashedToken, 
        reset_token_expires: new Date(Date.now() + 5 * 60 * 1000) // Token valid for 5 minutes
      }, 
      { where: { emp_id: employee.emp_id } }
    );
    
    // Create reset URL (replace with your frontend URL)
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${employee.emp_id}/${resetToken}`;
    
    // Send email with reset link
    const mailOptions = {
        from: `"Pumo Tech Support" <${process.env.EMAIL_USER}>`, // Friendly sender name
        to: email_id,
        subject: "Password Reset Request",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Password Reset Request</h2>
            <p>Hello,</p>
            <p>You requested a password reset for your account.</p>
            <p>
              Click the link below to reset your password. This link is valid for 1 hour:
            </p>
            <a href="${resetUrl}" target="_blank" style="
              display: inline-block;
              padding: 10px 20px;
              margin: 20px 0;
              background-color: #4CAF50;
              color: white;
              text-decoration: none;
              border-radius: 5px;">
              Reset Password
            </a>
            <p>If you didn’t request this, you can safely ignore this email.</p>
            <p>Thank you,<br>Pumo Tech Team</p>
          </div>
        `,
      };
      
    await transporter.sendMail(mailOptions);
    
    res.status(200).json({ 
      message: "Password reset link sent to your email",
      success: true
    });
    
  } catch (error) {
    console.error("Password reset request error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Verify reset token
exports.verifyResetToken = async (req, res) => {
  try {
    const { emp_id, token } = req.params;
    
    // Find the employee
    const employee = await Employee.findOne({ 
      where: { 
        emp_id,
        reset_token: { [Op.ne]: null },
        reset_token_expires: { [Op.gt]: new Date() }
      } 
    });
    
    if (!employee) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }
    
    // Verify the token matches
    const isValidToken = await bcrypt.compare(token, employee.reset_token);
    
    if (!isValidToken) {
      return res.status(400).json({ message: "Invalid reset token" });
    }
    
    // Token is valid
    res.status(200).json({ message: "Token verified, proceed to reset password" });
    
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { emp_id, token, newPassword } = req.body;
    
    // Find the employee
    const employee = await Employee.findOne({ 
      where: { 
        emp_id,
        reset_token: { [Op.ne]: null },
        reset_token_expires: { [Op.gt]: new Date() }
      } 
    });
    
    if (!employee) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }
    
    // Verify the token matches
    const isValidToken = await bcrypt.compare(token, employee.reset_token);
    
    if (!isValidToken) {
      return res.status(400).json({ message: "Invalid reset token" });
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the employee record
    await Employee.update(
      { 
        password: hashedPassword,
        reset_token: null,
        reset_token_expires: null
      },
      { where: { emp_id: employee.emp_id } }
    );
    
    // Send confirmation email
    const mailOptions = {
      from: process.env.EMAIL_FROM || "noreply@yourcompany.com",
      to: employee.email_id,
      subject: "Password Reset Successful",
      html: `
        <h1>Password Reset Successful</h1>
        <p>Your password has been successfully reset.</p>
        <p>If you did not perform this action, please contact support immediately.</p>
        <p>Thank you,</p>
        <p>Your Company Team</p>
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    res.status(200).json({ message: "Password has been reset successfully" });
    
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ error: error.message });
  }
};