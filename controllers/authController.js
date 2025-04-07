const Employee = require("../models/Employee");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.login = async (req, res) => {
  try {
    const { email_id, password } = req.body;

    // Find employee by email
    const employee = await Employee.findOne({ where: { email_id } });

    if (!employee) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if password is valid
    const isPasswordValid = await bcrypt.compare(password, employee.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Include branch and other relevant data in the token
    const token = jwt.sign(
      {
        emp_id: employee.emp_id,
        role: employee.role,
        email_id: employee.email_id,
        branch: employee.branch, // Ensure branch is included
        emp_name: employee.emp_name, // Ensure the user's name is included here
        has_access: employee.has_access, // ✅ Add this line


      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        emp_id: employee.emp_id,
        emp_name: employee.emp_name,
        role: employee.role,
        branch: employee.branch, // Return branch info to frontend
        email_id: employee.email_id,
        has_access: employee.has_access, // ✅ Add this line

      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
