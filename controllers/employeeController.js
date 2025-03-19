const Employee = require("../models/Employee");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Register Employee (Signup)
exports.createEmployee = async (req, res) => {
  try {
    const { password, ...employeeData } = req.body;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new employee
    const newEmployee = await Employee.create({ ...employeeData, password: hashedPassword });

    res.status(201).json({ message: "Employee registered successfully", employee: newEmployee });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Login Employee

exports.loginEmployee = async (req, res) => {
  try {
    const { email_id, password } = req.body;
    const employee = await Employee.findOne({ where: { email_id } });

    if (!employee) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, employee.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        emp_id: employee.emp_id,
        emp_name: employee.emp_name,
        role: employee.role,
        branch: employee.branch, // ✅ Only branch included
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get All Employees
// employeeController.js
exports.getEmployees = async (req, res) => {
  try {
    // Get the logged-in user's ID from req.user (populated by your middleware)
    const loggedInUserId = req.user.emp_id;
    
    // Find only the specific employee
    const employee = await Employee.findOne({
      where: { emp_id: loggedInUserId },
      attributes: ["email_id", "emp_id", "role", "location", "branch"],
    });

    console.log("Employee Fetched:", employee);
    
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    
    res.status(200).json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error);
    res.status(500).json({ error: error.message });
  }
};
  