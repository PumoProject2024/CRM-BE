const Employee = require("../models/Employee");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Op,Sequelize } = require('sequelize');


// Register Employee (Signup)
exports.createEmployee = async (req, res) => {
  try {
    const { password, ...employeeData } = req.body;

    // Get the highest emp_id in the table (cast to int for safety)
    const highestEmployee = await Employee.findOne({
      order: [['emp_id', 'DESC']],
    });

    // Start from 5000 if no employees exist
    const nextEmpId = highestEmployee
      ? parseInt(highestEmployee.emp_id) + 1
      : 5000;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new employee with auto-generated emp_id
    const newEmployee = await Employee.create({
      ...employeeData,
      emp_id: nextEmpId,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "Employee registered successfully",
      employee: newEmployee,
    });
  } catch (error) {
    console.error("Error creating employee:", error);
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

    // ❌ Removed the BDE access check

    const token = jwt.sign(
      {
        emp_id: employee.emp_id,
        emp_name: employee.emp_name,
        role: employee.role,
        branch: employee.branch,
        has_access: employee.has_access,
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
        attributes: ["email_id", "emp_id", "role", "location", "branch", "emp_name","has_access"],
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
      attributes: ["email_id", "emp_id", "role", "location", "branch", "emp_name","contact_num","alter_contact","address","has_access"],
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

// Get All Employee Details (No filters)
exports.getAllEmployeeDetails = async (req, res) => {
  try {
    // Import operators and Sequelize from sequelize
    const { Op, Sequelize } = require('sequelize');
    
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 20; // Default 20 per page
    const offset = (page - 1) * limit;
    
    // Get search parameters
    const nameSearch = req.query.name ? req.query.name.trim() : '';
    const branchSearch = req.query.branch ? req.query.branch.trim() : '';

    // Get user details from auth middleware
    const { role, branch: userBranches } = req.user;

    console.log('Search params:', { nameSearch, branchSearch });
    console.log('User details:', { role, userBranches });

    // Get all attributes dynamically
    const attributes = Object.keys(Employee.rawAttributes);

    // Build where condition for search filters
    const whereCondition = {};
    
    // ✅ Role-based branch filtering
    if (role === 'Branch-head') {
      // Branch-head can only see employees from their assigned branches
      const branchConditions = userBranches.map(branch => 
        Sequelize.literal(`"branch"::jsonb ? '${branch}'`)
      );
      
      if (branchConditions.length === 1) {
        whereCondition[Op.and] = branchConditions[0];
      } else if (branchConditions.length > 1) {
        whereCondition[Op.or] = branchConditions;
      }
      
      console.log('Branch-head restriction applied for branches:', userBranches);
    }
    // For other roles (like Admin), no branch restriction is applied
    
    // Add name search condition if provided
    if (nameSearch) {
      whereCondition.emp_name = {
        [Op.iLike]: `%${nameSearch}%` 
      };
    }
    
    // Add branch search condition if provided (and user has access to it)
    if (branchSearch) {
      if (role === 'Branch-head') {
        // Branch-head can only search within their assigned branches
        if (userBranches.includes(branchSearch)) {
          // Combine with existing branch restriction
          const existingBranchCondition = whereCondition[Op.and] || whereCondition[Op.or];
          const branchSearchCondition = Sequelize.literal(`"branch"::jsonb ? '${branchSearch}'`);
          
          if (existingBranchCondition) {
            // If there's already a branch condition, we need to ensure both are met
            whereCondition[Op.and] = [
              existingBranchCondition,
              branchSearchCondition
            ];
          } else {
            whereCondition[Op.and] = branchSearchCondition;
          }
        } else {
          // Branch-head trying to search a branch they don't have access to
          return res.status(403).json({ 
            message: `Access denied. You don't have permission to view employees from branch: ${branchSearch}` 
          });
        }
      } else {
        // For other roles, allow searching any branch
        const branchSearchCondition = Sequelize.literal(`"branch"::jsonb ? '${branchSearch}'`);
        if (whereCondition[Op.and]) {
          // If there's already an AND condition, combine them
          whereCondition[Op.and] = Array.isArray(whereCondition[Op.and]) 
            ? [...whereCondition[Op.and], branchSearchCondition]
            : [whereCondition[Op.and], branchSearchCondition];
        } else {
          whereCondition[Op.and] = branchSearchCondition;
        }
      }
    }

    // Set up order based on parameters
    let orderBy;
    if (branchSearch) {
      // If branch filter is applied, sort by name only
      orderBy = [['emp_name', 'ASC']];
    } else {
      // Default sort by name
      orderBy = [['emp_name', 'ASC']];
    }

    console.log('Final search conditions:', { 
      nameSearch, 
      branchSearch, 
      whereCondition, 
      orderBy,
      userRole: role
    });

    // Fetch paginated employees with filters
    const { count, rows: employees } = await Employee.findAndCountAll({
      attributes,
      where: whereCondition,
      limit,
      offset,
      order: orderBy
    });

    if (!employees || employees.length === 0) {
      return res.status(404).json({ message: "No employees found." });
    }

    const cleanEmployees = employees.map(emp => emp.get({ plain: true }));

    res.status(200).json({
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      perPage: limit,
      data: cleanEmployees,
      // ✅ Include user context in response for debugging
      userContext: {
        role,
        accessibleBranches: role === 'Branch-head' ? userBranches : 'All branches'
      }
    });
  } catch (error) {
    console.error("❌ Error in getAllEmployeeDetails:", error);
    res.status(500).json({ error: "Failed to fetch employee details." });
  }
};

exports.updateEmployeeById = async (req, res) => {
  try {
    const { emp_id } = req.params;
    const updateData = req.body;

    // Check if the employee exists
    const employee = await Employee.findByPk(emp_id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    // Update the employee with new data
    await employee.update(updateData);

    res.status(200).json({
      message: "Employee updated successfully.",
      data: employee.get({ plain: true }),
    });
  } catch (error) {
    console.error("❌ Error in updateEmployeeById:", error);
    res.status(500).json({ error: "Failed to update employee." });
  }
};

exports.deleteEmployeeById = async (req, res) => {
  try {
    const { emp_id } = req.params;

    // Find employee by primary key
    const employee = await Employee.findByPk(emp_id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    // Delete the employee
    await employee.destroy();

    res.status(200).json({ message: "Employee deleted successfully." });
  } catch (error) {
    console.error("❌ Error in deleteEmployeeById:", error);
    res.status(500).json({ error: "Failed to delete employee." });
  }
};



exports.getBDEEmployees = async (req, res) => {
  try {
    const { branch } = req.query;

    if (!branch) {
      return res.status(400).json({ message: "Branch query parameter is required." });
    }

    const cleanBranch = branch.replace(/"/g, "");

    const employees = await Employee.findAll({
      where: Sequelize.where(
        Sequelize.cast(Sequelize.col("role"), "TEXT"),
        {
          [Op.iLike]: "bde"
        }
      ),
      // Branch filter also needs cast if it's enum or json
      // Assuming it's text or varchar:
      ...(cleanBranch && {
        where: {
          [Op.and]: [
            Sequelize.where(Sequelize.cast(Sequelize.col("role"), "TEXT"), {
              [Op.iLike]: "bde",
            }),
            Sequelize.where(Sequelize.cast(Sequelize.col("branch"), "TEXT"), {
              [Op.iLike]: `%${cleanBranch}%`,
            }),
          ]
        }
      }),
      attributes: ["emp_id", "emp_name", "branch"],
    });

    res.status(200).json(employees.map(emp => emp.dataValues));
  } catch (error) {
    console.error("Error fetching BDE employees:", error);
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