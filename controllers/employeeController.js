const Employee = require("../models/Employee");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Op,Sequelize } = require('sequelize');


// Register Employee (Signup)
exports.createEmployee = async (req, res) => {
  try {
    const { password, ...employeeData } = req.body;
    
    // Assuming the logged-in user's ID is available in req.user.emp_id
    // If your authentication middleware stores it differently, adjust accordingly
    const loggedInUserId = req.user.emp_id;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
 
    // Create new employee with the modified_by field
    const newEmployee = await Employee.create({ 
      ...employeeData, 
      password: hashedPassword,
      modified_by: loggedInUserId // Add the logged-in user's ID
    });

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
    const loggedInUserId = req.user.emp_id;
    const { location, branch, role } = req.query;

    if (location && branch) {
      // Clean location and branch inputs
      const cleanLocation = location.replace(/"/g, "");
      const cleanBranch = branch.replace(/"/g, "");
      
      // Set default role filter to BDE if not specified
      const roleFilter = role || "BDE";

      // Fetch employees matching location, branch and role
      const employees = await Employee.findAll({
        where: {
          role: roleFilter,
          [Op.and]: [
            Sequelize.literal(`location::text ILIKE '%${cleanLocation}%'`),
            Sequelize.literal(`branch::text ILIKE '%${cleanBranch}%'`)
          ],
        },
        attributes: ["email_id", "emp_id", "role", "location", "branch", "emp_name"],
      });

      console.log(`Sequelize Query Result (${roleFilter}):`, employees);

      // Map to extract only the plain data (dataValues)
      const cleanEmployees = employees.map(emp => emp.dataValues);

      console.log(`Filtered ${roleFilter} Employees (Clean):`, cleanEmployees);
      return res.status(200).json(cleanEmployees);
    }

    // If no location/branch is provided, return the logged-in user
    const employee = await Employee.findOne({
      where: { emp_id: loggedInUserId },
      attributes: ["email_id", "emp_id", "role", "location", "branch", "emp_name","contact_num","alter_contact","address"],
    });

    console.log("Logged-in Employee:", employee);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Send clean data for a single employee
    res.status(200).json(employee.dataValues);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ error: error.message });
  }
};

// In your routes file

// In your controller file
exports.updateEmployeeProfile = async (req, res) => {
  try {
    const { emp_id, contact_num, alter_contact, address } = req.body;
    // Assuming the logged-in user's ID is available in req.user.emp_id
    // If your authentication middleware stores it differently, adjust accordingly
    const loggedInUserId = req.user.emp_id;
    
    const updatedEmployee = await Employee.update(
      { 
        contact_num, 
        alter_contact, 
        address,
        modified_by: loggedInUserId // Add the logged-in user's ID to the modified_by field
      },
      { where: { emp_id } }
    );
    
    if (updatedEmployee[0] === 0) {
      return res.status(404).json({ message: "Employee not found or no changes made" });
    }
    
    res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating employee profile:", error);
    res.status(500).json({ error: error.message });
  }
};

// Add this function to your existing controller file

exports.changePassword = async (req, res) => {
  try {
    const { emp_id, oldPassword, newPassword } = req.body;

    // Verify that the logged-in user is changing their own password
    const loggedInUserId = req.user.emp_id;
    if (loggedInUserId !== emp_id) {
      return res.status(403).json({ message: "You can only change your own password" });
    }

    // Find the employee by ID
    const employee = await Employee.findOne({ where: { emp_id } });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Verify the old password
    const isPasswordValid = await bcrypt.compare(oldPassword, employee.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    await Employee.update(
      { 
        password: hashedPassword,
        modified_by: loggedInUserId // Track who made the change
      },
      { where: { emp_id } }
    );
    
    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: error.message });
  }
};