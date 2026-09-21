const Employee = require("../models/Employee");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Op, Sequelize } = require('sequelize');
const ExcelJS = require('exceljs');
const { sendEmployeeCredentials } = require('../utils/emailService');
const StudentCourse = require("../models/StudentCourse");
const { formatDistanceToNow } = require("date-fns");

// MariaDB equivalent of the PostgreSQL jsonb "?" (element exists) test used by the branch/department filters:
// true when the JSON column (an array of strings, or a single JSON string) contains exactly that string.
// Exact, case-sensitive match; NULL column -> not a match. The value is escaped by Sequelize, never concatenated.
const jsonHasElement = (column, value) =>
  Sequelize.where(
    Sequelize.fn("JSON_CONTAINS", Sequelize.col(column), Sequelize.fn("JSON_QUOTE", String(value))),
    1
  );

// Register Employee (Signup)
exports.createEmployee = async (req, res) => {
  try {
    const { password, ...employeeData } = req.body;

    // Find highest emp_id
    const highestEmployee = await Employee.findOne({
      order: [["emp_id", "DESC"]],
    });

    const nextEmpId = highestEmployee
      ? parseInt(highestEmployee.emp_id) + 1
      : 5000;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create employee
    const newEmployee = await Employee.create({
      ...employeeData,
      emp_id: nextEmpId,
      password: hashedPassword,
    });

    // Send credentials email
    await sendEmployeeCredentials(newEmployee.email_id, password);

    res.status(201).json({
      message: "Employee registered successfully and credentials sent.",
      employee: newEmployee,
    });
  } catch (error) {
    console.error("❌ Error creating employee:", error);
    res.status(400).json({ error: error.message });
  }
};

// Login Employee

exports.loginEmployee = async (req, res) => {
  try {

    const { email_id, password } = req.body;

    const employee = await Employee.findOne({
      where: { email_id }
    });

    if (!employee) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // ✅ Check employee active/deactive status
    if (!employee.has_access) {
      return res.status(403).json({
        message: "Your account is deactivated. Please contact admin."
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      employee.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    await Employee.update(
      {
        lastLogin: new Date()
      },
      {
        where: {
          emp_id: employee.emp_id
        }
      }
    );

    const token = jwt.sign(
      {
        emp_id: employee.emp_id,
        emp_name: employee.emp_name,
        role: employee.role,
        branch: employee.branch,
        has_access: employee.has_access,
        contact_num: employee.contact_num,
        Department: employee.Department
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h"
      }
    );

    res.json({ token });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }
};

// Get All Employees
// employeeController.js
exports.getEmployees = async (req, res) => {
  try {
    const loggedInUserId = req.user.emp_id;
    let { location, branch, role } = req.query;

    // 🧩 Normalize all possible data types for location and branch
    const normalizeValue = (val) => {
      if (!val) return "";
      if (Array.isArray(val)) return String(val[0]);
      if (typeof val === "object") return String(val.branch || val.name || "");
      return String(val);
    };

    const cleanLocation = normalizeValue(location).replace(/"/g, "");
    const cleanBranch = normalizeValue(branch).replace(/"/g, "");

    // Debug log to verify what backend receives
    console.log("🔍 Query received:", { location, branch, role });
    console.log("✅ Cleaned values:", { cleanLocation, cleanBranch });

    if (cleanLocation && cleanBranch) {
      const roleFilter = role || "BDE";

      const employees = await Employee.findAll({
        where: {
          role: roleFilter,
          [Op.and]: [
            Sequelize.where(Sequelize.cast(Sequelize.col("location"), "CHAR"), { [Op.like]: `%${cleanLocation}%` }),
            Sequelize.where(Sequelize.cast(Sequelize.col("branch"), "CHAR"), { [Op.like]: `%${cleanBranch}%` })
          ],
        },
        attributes: [
          "email_id",
          "emp_id",
          "role",
          "location",
          "branch",
          "emp_name",
          "has_access",
          "contact_num",
        ],
      });

      console.log(`✅ Filtered ${roleFilter} Employees Count:`, employees.length);
      return res.status(200).json(employees.map(e => e.dataValues));
    }

    // 🧩 If no location/branch is provided, return the logged-in user's details
    const employee = await Employee.findOne({
      where: { emp_id: loggedInUserId },
      attributes: [
        "email_id",
        "emp_id",
        "role",
        "location",
        "branch",
        "emp_name",
        "contact_num",
        "alter_contact",
        "address",
        "has_access",
      ],
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json(employee.dataValues);

  } catch (error) {
    console.error("❌ Error fetching employees:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get All Employee Details (No filters)
// controllers/employeeController.js
exports.getAllEmployeeDetails = async (req, res) => {

  try {

    const { Op, Sequelize } = require("sequelize");

    const {
      search,
      branch,
      department,
      role,
      loginFrom,
      loginTo,
      lastLoginFilter,
      has_access,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;

    const andConditions = [];

    // =====================================================
    // SEARCH
    // =====================================================

    if (search && search.trim()) {

      const searchValue = search.trim();

      andConditions.push({

        emp_name: {
          [Op.like]: `%${searchValue}%`
        }

      });

    }
    // =====================================================
    // BRANCH FILTER (MULTI SELECT)
    // =====================================================

    if (branch) {

      const branches = branch
        .split(",")
        .map(b => b.trim());

      const branchConditions = branches.map(branchName =>
        jsonHasElement("branch", branchName)
      );

      andConditions.push({

        [Op.or]: branchConditions

      });

    }

    // =====================================================
    // DEPARTMENT FILTER (MULTI SELECT)
    // =====================================================

    if (department) {

      const departments = department
        .split(",")
        .map(d => d.trim());

      const departmentConditions = departments.map(dep =>
        jsonHasElement("Department", dep)
      );

      andConditions.push({

        [Op.or]: departmentConditions

      });

    }

    // =====================================================
    // ROLE FILTER (MULTI SELECT)
    // =====================================================

    if (role) {

      const roles = role
        .split(",")
        .map(r => r.trim());

      andConditions.push({

        role: {
          [Op.in]: roles
        }

      });

    }
    // =====================================================
    // LOGIN DATE FILTER
    // =====================================================

    if (lastLoginFilter) {

      if (lastLoginFilter === "never") {

        andConditions.push({
          lastLogin: null
        });

      } else {

        const days =
          parseInt(lastLoginFilter);

        const fromDate =
          new Date();

        fromDate.setDate(
          fromDate.getDate() - days
        );

        andConditions.push({
          lastLogin: {
            [Op.gte]: fromDate
          }
        });

      }

    }
    else if (loginFrom || loginTo) {

      const loginCondition = {};

      if (loginFrom) {

        loginCondition[Op.gte] =
          new Date(loginFrom);

      }

      if (loginTo) {

        const endDate =
          new Date(loginTo);

        endDate.setHours(
          23, 59, 59, 999
        );

        loginCondition[Op.lte] =
          endDate;

      }

      andConditions.push({

        lastLogin:
          loginCondition

      });

    }

    // =====================================================
    // ACCESS FILTER
    // =====================================================

    if (
      has_access !== undefined &&
      has_access !== ""
    ) {

      andConditions.push({

        has_access:
          has_access === "true"

      });

    }

    // =====================================================
    // BRANCH HEAD RESTRICTION
    // =====================================================

    if (req.user.role === "Branch-head") {

      let userBranches = [];

      if (Array.isArray(req.user.branch)) {

        userBranches = req.user.branch;

      }

      else if (typeof req.user.branch === "string") {

        try {

          userBranches = JSON.parse(req.user.branch);

        }

        catch {

          userBranches = [req.user.branch];

        }

      }

      const userBranchConditions = userBranches.map(branchName =>
        jsonHasElement("branch", branchName)
      );

      andConditions.push({

        [Op.or]: userBranchConditions

      });

    }

    // =====================================================
    // FINAL QUERY
    // =====================================================

    const { count, rows } = await Employee.findAndCountAll({

      where: {
        [Op.and]: andConditions
      },

      limit: parseInt(limit),

      offset,

      order: [["emp_name", "ASC"]]

    });
    res.status(200).json({

      success: true,

      data: rows,

      pagination: {

        currentPage: parseInt(page),

        totalPages: Math.ceil(count / limit),

        totalRecords: count

      }

    });

  }

  catch (error) {

    console.error("❌ Error fetching employees:", error);

    res.status(500).json({
      message: "Failed to fetch employees"
    });

  }

};

exports.toggleEmployeeAccess = async (req, res) => {

  try {

    const { emp_id } =
      req.params;

    const { has_access } =
      req.body;

    const employee =
      await Employee.findByPk(
        emp_id
      );

    if (!employee) {

      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });

    }

    await employee.update({
      has_access
    });

    res.status(200).json({
      success: true,
      message: has_access
        ? "Employee activated successfully"
        : "Employee deactivated successfully"
    });

  } catch (error) {

    console.error(
      "Toggle Access Error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });

  }

};

exports.downloadEmployeeExcel = async (req, res) => {

  try {

    const ExcelJS = require("exceljs");

    const { Op, Sequelize } = require("sequelize");

    const { formatDistanceToNow } =
      require("date-fns");

    const {
      search,
      branch,
      department,
      role,
      loginFrom,
      loginTo,
      lastLoginFilter,
      has_access
    } = req.query;

    const andConditions = [];

    // =====================================================
    // SEARCH
    // =====================================================

    if (search?.trim()) {

      andConditions.push({

        emp_name: {
          [Op.like]:
            `%${search.trim()}%`
        }

      });

    }

    // =====================================================
    // BRANCH
    // =====================================================

    if (branch) {

      const branches =
        branch
          .split(",")
          .map(b => b.trim());

      const branchConditions =
        branches.map(branchName =>

          jsonHasElement("branch", branchName)

        );

      andConditions.push({

        [Op.or]:
          branchConditions

      });

    }

    // =====================================================
    // DEPARTMENT
    // =====================================================

    if (department) {

      const departments =
        department
          .split(",")
          .map(d => d.trim());

      const departmentConditions =
        departments.map(dep =>

          jsonHasElement("Department", dep)

        );

      andConditions.push({

        [Op.or]:
          departmentConditions

      });

    }

    // =====================================================
    // ROLE
    // =====================================================

    if (role) {

      const roles =
        role
          .split(",")
          .map(r => r.trim());

      andConditions.push({

        role: {
          [Op.in]: roles
        }

      });

    }

    // =====================================================
    // LAST LOGIN FILTER
    // =====================================================

    if (lastLoginFilter) {

      if (
        lastLoginFilter === "never"
      ) {

        andConditions.push({

          lastLogin: null

        });

      }

      else {

        const days =
          parseInt(
            lastLoginFilter
          );

        const fromDate =
          new Date();

        fromDate.setDate(
          fromDate.getDate() - days
        );

        andConditions.push({

          lastLogin: {
            [Op.gte]: fromDate
          }

        });

      }

    }

    else if (
      loginFrom ||
      loginTo
    ) {

      const loginCondition = {};

      if (loginFrom) {

        loginCondition[Op.gte] =
          new Date(loginFrom);

      }

      if (loginTo) {

        const endDate =
          new Date(loginTo);

        endDate.setHours(
          23, 59, 59, 999
        );

        loginCondition[Op.lte] =
          endDate;

      }

      andConditions.push({

        lastLogin:
          loginCondition

      });

    }

    // =====================================================
    // ACCESS FILTER
    // =====================================================

    if (
      has_access !== undefined &&
      has_access !== ""
    ) {

      andConditions.push({

        has_access:
          has_access === "true"

      });

    }

    // =====================================================
    // FETCH EMPLOYEES
    // =====================================================

    const employees =
      await Employee.findAll({

        where: {
          [Op.and]:
            andConditions
        },

        order: [
          ["emp_name", "ASC"]
        ]

      });

    // =====================================================
    // EXCEL
    // =====================================================

    const workbook =
      new ExcelJS.Workbook();

    const worksheet =
      workbook.addWorksheet(
        "Employees"
      );

    worksheet.columns = [

      {
        header: "Employee ID",
        key: "emp_id",
        width: 15
      },

      {
        header: "Employee Name",
        key: "emp_name",
        width: 30
      },

      {
        header: "Email",
        key: "email",
        width: 35
      },

      {
        header: "Contact Number",
        key: "contact_num",
        width: 20
      },

      {
        header: "Role",
        key: "role",
        width: 20
      },

      {
        header: "Department",
        key: "department",
        width: 25
      },

      {
        header: "Branch",
        key: "branch",
        width: 25
      },

      {
        header: "Student Count",
        key: "studentCount",
        width: 18
      },

      {
        header: "Status",
        key: "has_access",
        width: 15
      },

      {
        header: "Last Login",
        key: "lastLogin",
        width: 25
      }

    ];

    for (const emp of employees) {

      const employeeId =
        String(emp.emp_id);

      const employeeName =
        emp.emp_name;

      const studentCount =
        await StudentCourse.count({

          where: {

            [Op.or]: [

              { staffId1: employeeId },
              { staffId2: employeeId },
              { staffId3: employeeId },

              { staffName1: employeeName },
              { staffName2: employeeName },
              { staffName3: employeeName },

              { mentorid: employeeId },
              { mentor: employeeName }

            ]

          }

        });

      worksheet.addRow({

        emp_id:
          emp.emp_id,

        emp_name:
          emp.emp_name,

        email:
          emp.email_id,

        contact_num:
          emp.contact_num,

        role:
          emp.role,

        department:
          Array.isArray(
            emp.Department
          )
            ? emp.Department.join(", ")
            : emp.Department,

        branch:
          Array.isArray(
            emp.branch
          )
            ? emp.branch.join(", ")
            : emp.branch,

        studentCount,

        has_access:
          emp.has_access
            ? "Active"
            : "Inactive",

        lastLogin:
          emp.lastLogin
            ? formatDistanceToNow(
              new Date(
                emp.lastLogin
              ),
              {
                addSuffix: true
              }
            )
            : "Never Logged In"

      });

    }

    worksheet.getRow(1).font = {

      bold: true

    };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Employee_Report.xlsx"
    );

    await workbook.xlsx.write(res);

    res.end();

  }

  catch (error) {

    console.error(
      "Excel Download Error:",
      error
    );

    res.status(500).json({

      message:
        "Failed to download excel"

    });

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

    const employee =
      await Employee.findByPk(emp_id);

    if (!employee) {

      return res.status(404).json({
        message: "Employee not found."
      });

    }

    const { Op } = require("sequelize");

    const employeeId =
      String(employee.emp_id);

    const employeeName =
      employee.emp_name;

    const mappedStudents =
      await StudentCourse.findAll({

        where: {

          [Op.or]: [

            { staffId1: employeeId },
            { staffId2: employeeId },
            { staffId3: employeeId },

            { staffName1: employeeName },
            { staffName2: employeeName },
            { staffName3: employeeName },

            { mentorid: employeeId },
            { mentor: employeeName }

          ]

        },

        attributes: [
          "studentId",
          "studentName"
        ]

      });

    if (mappedStudents.length > 0) {

      return res.status(400).json({

        message:
          `Cannot delete employee. Employee is assigned to ${mappedStudents.length} student(s). Please replace the staff/mentor before deleting.`,

        students:
          mappedStudents

      });

    }

    await employee.destroy();

    res.status(200).json({
      message:
        "Employee deleted successfully."
    });

  }

  catch (error) {

    console.error(
      "❌ Error in deleteEmployeeById:",
      error
    );

    res.status(500).json({
      error:
        "Failed to delete employee."
    });

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
          [Op.like]: "bde"
        }
      ),
      // Branch filter also needs cast if it's enum or json
      // Assuming it's text or varchar:
      ...(cleanBranch && {
        where: {
          [Op.and]: [
            Sequelize.where(Sequelize.cast(Sequelize.col("role"), "TEXT"), {
              [Op.like]: "bde",
            }),
            Sequelize.where(Sequelize.cast(Sequelize.col("branch"), "TEXT"), {
              [Op.like]: `%${cleanBranch}%`,
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
            [Op.like]: "trainer"
          }),
          Sequelize.where(Sequelize.cast(Sequelize.col("branch"), "TEXT"), {
            [Op.like]: `%${cleanBranch}%`
          })
        ]
      },
      attributes: ["emp_id", "emp_name", "branch", "contact_num"]
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
          [Op.like]: "placement officer"
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
exports.getEmployeeNames = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      attributes: ["emp_name"]
    });

    res.status(200).json(
      employees.map(emp => emp.emp_name)
    );
  } catch (error) {
    console.error("Error fetching employee names:", error);
    res.status(500).json({ error: error.message });
  }
};

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

exports.replaceEmployeeMapping = async (
  req,
  res
) => {

  try {

    const {
      oldEmpId,
      newStaffEmpId,
      newMentorEmpId
    } = req.body;

    // =========================================
    // VALIDATION
    // =========================================

    if (
      !oldEmpId ||
      !newStaffEmpId ||
      !newMentorEmpId
    ) {

      return res.status(400).json({

        message:
          "Old employee, new staff employee and new mentor employee are required."

      });

    }

    // =========================================
    // FIND EMPLOYEES
    // =========================================

    const oldEmployee =
      await Employee.findByPk(oldEmpId);

    const newStaffEmployee =
      await Employee.findByPk(newStaffEmpId);

    const newMentorEmployee =
      await Employee.findByPk(newMentorEmpId);

    if (!oldEmployee) {

      return res.status(404).json({

        message:
          "Old employee not found."

      });

    }

    if (!newStaffEmployee) {

      return res.status(404).json({

        message:
          "New staff employee not found."

      });

    }

    if (!newMentorEmployee) {

      return res.status(404).json({

        message:
          "New mentor employee not found."

      });

    }

    // =========================================
    // PREPARE VALUES
    // =========================================

    const oldId =
      String(oldEmployee.emp_id);

    const oldName =
      oldEmployee.emp_name;

    // =========================================
    // FIND ALL MAPPED STUDENTS
    // =========================================

    const { Op } =
      require("sequelize");

    const students =
      await StudentCourse.findAll({

        where: {

          [Op.or]: [

            { staffId1: oldId },
            { staffId2: oldId },
            { staffId3: oldId },

            { staffName1: oldName },
            { staffName2: oldName },
            { staffName3: oldName },

            { mentorid: oldId },
            { mentor: oldName }

          ]

        }

      });

    // =========================================
    // UPDATE STUDENTS
    // =========================================

    for (const student of students) {

      // =====================================
      // STAFF 1
      // =====================================

      if (
        student.staffId1 === oldId ||
        student.staffName1 === oldName
      ) {

        student.staffId1 =
          String(newStaffEmployee.emp_id);

        student.staffName1 =
          newStaffEmployee.emp_name;

      }

      // =====================================
      // STAFF 2
      // =====================================

      if (
        student.staffId2 === oldId ||
        student.staffName2 === oldName
      ) {

        student.staffId2 =
          String(newStaffEmployee.emp_id);

        student.staffName2 =
          newStaffEmployee.emp_name;

      }

      // =====================================
      // STAFF 3
      // =====================================

      if (
        student.staffId3 === oldId ||
        student.staffName3 === oldName
      ) {

        student.staffId3 =
          String(newStaffEmployee.emp_id);

        student.staffName3 =
          newStaffEmployee.emp_name;

      }

      // =====================================
      // MENTOR
      // =====================================

      if (
        student.mentorid === oldId ||
        student.mentor === oldName
      ) {

        student.mentorid =
          String(newMentorEmployee.emp_id);

        student.mentor =
          newMentorEmployee.emp_name;

        student.mentorNumber =
          newMentorEmployee.contact_num;

      }

      await student.save();

    }

    // =========================================
    // SUCCESS RESPONSE
    // =========================================

    res.status(200).json({

      success: true,

      message:
        `${students.length} student mapping(s) replaced successfully.`

    });

  }

  catch (error) {

    console.error(
      "❌ Error replacing employee mapping:",
      error
    );

    res.status(500).json({

      message:
        "Failed to replace employee mapping."

    });

  }

};