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

    // Find employee by email
    const employee = await Employee.findOne({ where: { email_id } });
    if (!employee) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign({ emp_id: employee.emp_id, email_id: employee.email_id }, process.env.JWT_SECRET, { expiresIn: "5h" });

    res.status(200).json({ message: "Login successful", token});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get All Employees
exports.getEmployees = async (req, res) => {
    try {
      const employees = await Employee.findAll({
        attributes: ["email_id","emp_id"], // Select only the email_id field
      });
      res.status(200).json(employees);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  