const Employee = require("../models/Employee");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Op, Sequelize } = require('sequelize');


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
        attributes: ["email_id", "emp_id", "role", "location", "branch", "emp_name", "has_access"],
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
      attributes: ["email_id", "emp_id", "role", "location", "branch", "emp_name", "contact_num", "alter_contact", "address", "has_access"],
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
// controllers/employeeController.js
exports.getAllEmployeeDetails = async (req, res) => {
  try {
    const { Op, Sequelize } = require('sequelize');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const searchQuery = req.query.search ? req.query.search.trim() : '';
    const branchSearch = req.query.branch ? req.query.branch.trim() : '';

    const { role, branch: userBranches } = req.user;

    console.log('🔍 Search params:', { searchQuery, branchSearch });
    console.log('👤 User details:', { role, userBranches });

    const attributes = Object.keys(Employee.rawAttributes);
    const whereCondition = {};

    // Branch-head role restriction
    if (role === 'Branch-head') {
      const branchConditions = userBranches.map(branch =>
        Sequelize.literal(`"branch"::jsonb ? '${branch}'`)
      );

      if (branchConditions.length === 1) {
        whereCondition[Op.and] = branchConditions[0];
      } else if (branchConditions.length > 1) {
        whereCondition[Op.or] = branchConditions;
      }

      console.log('🏢 Branch-head restriction applied for branches:', userBranches);
    }

    // Search functionality for name, email, and role
    if (searchQuery) {
      const validRoles = ["BDE", "Trainer", "Placement officer", "Branch-head", "CEO", "Super-Admin"];
      
      const searchConditions = [];

      // Name search
      searchConditions.push({ emp_name: { [Op.iLike]: `%${searchQuery}%` } });
      
      // Email search  
      searchConditions.push({ email_id: { [Op.iLike]: `%${searchQuery}%` } });

      // Role search - try multiple approaches
      const matchingRoles = validRoles.filter(r => 
        r.toLowerCase() === searchQuery.toLowerCase() ||
        r.toLowerCase().includes(searchQuery.toLowerCase()) ||
        searchQuery.toLowerCase().includes(r.toLowerCase())
      );

      if (matchingRoles.length > 0) {
        // Add each matching role as a separate condition
        matchingRoles.forEach(matchingRole => {
          searchConditions.push({ role: matchingRole });
        });
        console.log(`✅ Role search matches found: "${searchQuery}" -> [${matchingRoles.join(', ')}]`);
      } else {
        console.log(`❌ No role match for: "${searchQuery}". Available roles:`, validRoles);
      }

      console.log('🔎 All search conditions:', searchConditions);

      // Apply search conditions properly
      if (searchConditions.length > 0) {
        if (Object.keys(whereCondition).length > 0) {
          // If there are existing conditions (like branch restrictions)
          const existingConditions = whereCondition[Op.and] || whereCondition[Op.or] || whereCondition;
          whereCondition[Op.and] = [
            ...(Array.isArray(existingConditions) ? existingConditions : [existingConditions]),
            { [Op.or]: searchConditions }
          ];
          // Clean up old keys
          if (whereCondition[Op.or] && whereCondition[Op.and]) delete whereCondition[Op.or];
        } else {
          // No existing conditions, just apply search
          whereCondition[Op.or] = searchConditions;
        }
      }
    }

    // Branch-specific search
    if (branchSearch) {
      const branchSearchCondition = Sequelize.literal(`"branch"::jsonb ? '${branchSearch}'`);

      if (role === 'Branch-head' && !userBranches.includes(branchSearch)) {
        return res.status(403).json({
          message: `Access denied. You don't have permission to view employees from branch: ${branchSearch}`
        });
      }

      if (whereCondition[Op.and]) {
        whereCondition[Op.and] = Array.isArray(whereCondition[Op.and])
          ? [...whereCondition[Op.and], branchSearchCondition]
          : [whereCondition[Op.and], branchSearchCondition];
      } else if (whereCondition[Op.or]) {
        const existingOr = whereCondition[Op.or];
        delete whereCondition[Op.or];
        whereCondition[Op.and] = [
          { [Op.or]: existingOr },
          branchSearchCondition
        ];
      } else {
        whereCondition[Op.and] = branchSearchCondition;
      }
    }

    const orderBy = [['emp_name', 'ASC']];

    console.log('🎯 Final where condition:', JSON.stringify(whereCondition, null, 2));

    // First, let's check what employees exist in the database for debugging
    if (searchQuery.toLowerCase() === 'trainer') {
      console.log('🐛 DEBUG: Checking for Trainer role employees...');
      const debugTrainers = await Employee.findAll({
        attributes: ['emp_name', 'role', 'email_id'],
        where: { role: 'Trainer' },
        limit: 5
      });
      console.log('🐛 Found Trainer employees:', debugTrainers.map(emp => emp.get({ plain: true })));
    }

    const { count, rows: employees } = await Employee.findAndCountAll({
      attributes,
      where: whereCondition,
      limit,
      offset,
      order: orderBy
    });

    console.log(`📊 Query result: Found ${count} employees, returning ${employees.length} employees`);

    if (!employees || employees.length === 0) {
      return res.status(404).json({ 
        message: "No employees found.",
        debugInfo: {
          searchQuery,
          whereCondition: JSON.stringify(whereCondition),
          totalEmployeesInDB: await Employee.count()
        }
      });
    }

    const cleanEmployees = employees.map(emp => emp.get({ plain: true }));

    res.status(200).json({
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      perPage: limit,
      data: cleanEmployees,
      userContext: {
        role,
        accessibleBranches: role === 'Branch-head' ? userBranches : 'All branches'
      },
      searchInfo: {
        searchQuery,
        branchSearch,
        searchFields: ['emp_name', 'email_id', 'role'],
        availableRoles: ["BDE", "Trainer", "Placement officer", "Branch-head", "CEO", "Super-Admin"],
        note: 'Search works across name, email, and role fields'
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

exports.getTrainerEmployees = async (req, res) => {
  try {
    const { branch } = req.query;

    if (!branch) {
      return res.status(400).json({ message: "Branch query parameter is required." });
    }

    const cleanBranch = branch.replace(/"/g, "");

    const employees = await Employee.findAll({
      where: {
        [Op.and]: [
          Sequelize.where(Sequelize.cast(Sequelize.col("role"), "TEXT"), {
            [Op.iLike]: "trainer"
          }),
          Sequelize.where(Sequelize.cast(Sequelize.col("branch"), "TEXT"), {
            [Op.iLike]: `%${cleanBranch}%`
          })
        ]
      },
      attributes: ["emp_id", "emp_name", "branch"]
    });

    res.status(200).json(employees.map(emp => emp.dataValues));
  } catch (error) {
    console.error("Error fetching Trainer employees:", error);
    res.status(500).json({ error: error.message });
  }
};
exports.getPlacementOfficerNames = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      where: Sequelize.where(
        Sequelize.cast(Sequelize.col("role"), "TEXT"),
        {
          [Op.iLike]: "placement officer"
        }
      ),
      attributes: ["emp_name"]
    });

    res.status(200).json(employees.map(emp => emp.emp_name));
  } catch (error) {
    console.error("Error fetching Placement Officer names:", error);
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