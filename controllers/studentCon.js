const { Op, Sequelize } = require('sequelize');
const StudentRegistration = require('../models/studenReg');
const StudentCourse = require('../models/StudentCourse');
const sequelize = require('../config/database');
const { fn, col, where } = require('sequelize');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const StudentDeviceToken = require("../models/StudentDeviceToken");

// Numeric suffix of a studentId, e.g. "CO-CH-1001" -> 1001, "CO-CH-0007" -> 7. NULL when the id does not end in digits.
// (The original PostgreSQL expression cast the regex-extracted trailing digits to INTEGER.)
// MariaDB's REGEXP_SUBSTR returns an empty string, not NULL, when nothing matches, hence the NULLIF.
const STUDENT_ID_NUMBER_SQL = `CAST(NULLIF(REGEXP_SUBSTR(studentId, '[0-9]+$'), '') AS UNSIGNED)`;

// ORDER BY the numeric suffix, highest first. PostgreSQL sorts NULLs FIRST for DESC while MariaDB sorts them LAST, so ids
// without a numeric suffix are put first explicitly to keep the existing order.
const orderByStudentIdNumberDesc = () => [
  [Sequelize.literal(`(${STUDENT_ID_NUMBER_SQL}) IS NULL`), 'DESC'],
  [Sequelize.literal(STUDENT_ID_NUMBER_SQL), 'DESC'],
];

// Now you can use sequelize in your updateStudentRegistration function

// Add this utility function (can be in a separate utils file or at the top of your controller)

const BRANCH_ABBREVIATIONS = {
  "Tambaram": "TM",
  "Velachery": "VL",
  "Vadapalani": "VP",
  "Poonamallee": "PM",
  "Marathahalli": "MH",
  "Gandhipuram": "GP",
  "Malumichampatti": "MP",
  "Hosur": "HS",
  "Saravanampatti": "SP",
  "Tiruppur": "TP",
  "Padi": "PD",
  // Add more as needed
};

const COURSE_TYPE_ABBREVIATIONS = {
  "CADD": "CD",
  "Pumo Tech IT": "PI",
  "Pumo Tech Automation": "PA",
  "Monz Creative School": "MZ",

};

const getBranchAbbreviation = (branchName) => {
  if (!branchName) return "UNK"; // Unknown branch

  // Check if we have a predefined abbreviation
  if (BRANCH_ABBREVIATIONS[branchName]) {
    return BRANCH_ABBREVIATIONS[branchName];
  }

  // Fallback: first 2 letters uppercase
  return branchName.substring(0, 2).toUpperCase();
};

const getCourseTypeAbbreviation = (courseType) => {
  if (!courseType) return "CR"; // Default to "Course" if none specified

  // Check if we have a predefined abbreviation
  if (COURSE_TYPE_ABBREVIATIONS[courseType]) {
    return COURSE_TYPE_ABBREVIATIONS[courseType];
  }

  // Fallback: first 2 letters uppercase
  return courseType.substring(0, 2).toUpperCase();
};

class StudentRegistrationController {
  // In your student registration controller
  static async createStudentRegistration(req, res) {
    try {
      const studentData = req.body;
      const user = req.user;
      const { preview } = req.query;

      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // 🔹 Generate next studentId logic with course type included
      const generateNextId = async (branch, courseType) => {
        const branchAbbr = getBranchAbbreviation(branch);
        const courseAbbr = getCourseTypeAbbreviation(courseType || "Course");

        const branchPattern = `%-${branchAbbr}-%`;

        const allBranchStudents = await StudentRegistration.findAll({
          where: { studentId: { [Op.like]: branchPattern } },
          attributes: ["studentId"],
          raw: true,
        });

        let highestNumber = 1000;
        if (allBranchStudents.length > 0) {
          allBranchStudents.forEach((student) => {
            const parts = student.studentId.split("-");
            if (parts.length === 3) {
              const number = parseInt(parts[2], 10);
              if (!isNaN(number) && number > highestNumber) {
                highestNumber = number;
              }
            }
          });
        }

        const nextNumber = highestNumber + 1;
        return `${courseAbbr}-${branchAbbr}-${nextNumber}`;
      };

      // 🟢 CASE 1: Only preview next ID
      if (preview === "true") {
        if (!studentData.adminbranch) {
          return res.status(400).json({ message: "Admin branch is required for ID generation" });
        }

        const courseType = studentData.courseType || "Course";
        const nextId = await generateNextId(studentData.adminbranch, courseType);

        return res.json({ nextId });
      }

      // 🟢 CASE 2: Actual registration
      const { email_Id, contactNo, course, adminbranch, courseType } = studentData;

      if (!contactNo || !course || !adminbranch) {
        return res.status(400).json({
          message: "Contact number, course, and admin branch are required.",
        });
      }

      // 🔹 Check if email already exists (for any course)
      if (email_Id) {
        const existingEmail = await StudentRegistration.findOne({
          where: { email_Id },
          attributes: ["studentId", "email_Id", "modified_by", "course"],
        });

        if (existingEmail) {
          return res.status(409).json({
            success: false,
            message: `This email (${email_Id}) has already been registered for the course "${existingEmail.course}" by ${existingEmail.modified_by}.`,
            registeredBy: existingEmail.modified_by,
          });
        }
      }

      // 🔹 Check if same contactNo is registered for the same course
      const existingContact = await StudentRegistration.findOne({
        where: { contactNo },
        attributes: ["studentId", "contactNo", "modified_by"],
      });

      if (existingContact) {
        return res.status(409).json({
          success: false,
          message: `This contact number (${contactNo}) is already registered by ${existingContact.modified_by}.`,
          registeredBy: existingContact.modified_by,
        });
      }

      if (existingContact) {
        return res.status(409).json({
          success: false,
          message: `This contact number (${contactNo}) has already registered for the course "${course}" by ${existingContact.modified_by}.`,
          registeredBy: existingContact.modified_by,
        });
      }

      // 🔹 Generate student ID with course type
      const studentId = await generateNextId(adminbranch, courseType || "Course");
      studentData.studentId = studentId;
      studentData.modified_by = user.emp_id;

      const newRegistration = await StudentRegistration.create(studentData);

      res.status(201).json({
        success: true,
        message: "Registration successful",
        student: newRegistration,
      });
    } catch (error) {
      console.error("❌ Error creating student registration:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }


  static async getAllStudentRegistrations(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        searchField,
        dueToday,
        todaysAdmission,
        pendingFeesList,
        pendingFeesOverdue,
        fromDate,
        toDate,
        ...filters
      } = req.query;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);

      const completionStatuses = [
        'Course Completed',
        'Course and Certified Completed',
        'Course Completed, Certified, and Successfully Placed'
      ];

      const options = {
        where: {
          // EXCLUDE students with completion status AND no pending fees
          [Op.not]: {
            [Op.and]: [
              { studentProgressStatus: { [Op.in]: completionStatuses } },
              {
                [Op.and]: [
                  {
                    [Op.or]: [
                      { pendingFees: { [Op.eq]: 0 } },
                      { pendingFees: { [Op.is]: null } }
                    ]
                  },
                  {
                    [Op.or]: [
                      { pendingFees2: { [Op.eq]: 0 } },
                      { pendingFees2: { [Op.is]: null } }
                    ]
                  },
                  {
                    [Op.or]: [
                      { pendingFees3: { [Op.eq]: 0 } },
                      { pendingFees3: { [Op.is]: null } }
                    ]
                  },
                  {
                    [Op.or]: [
                      { pendingFees4: { [Op.eq]: 0 } },
                      { pendingFees4: { [Op.is]: null } }
                    ]
                  }
                ]
              }
            ]
          }
        },
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
        order: orderByStudentIdNumberDesc()
      };

      // Extract allowed branches from user
      const { role, emp_name, branch: allowedBranches } = req.user;

      if (!role || !emp_name) {
        return res.status(403).json({ message: "Access denied: User role or emp_name is missing" });
      }
      if (!allowedBranches || allowedBranches.length === 0) {
        return res.status(403).json({ message: "Access denied: No branch assigned" });
      }

      // Ensure branch filtering
      if (role === "Trainer") {
        options.where = {
          ...options.where,
          [Op.and]: [
            where(fn('LOWER', col('staffAssigned')), fn('LOWER', emp_name)),
            { adminbranch: { [Op.in]: allowedBranches } }
          ]
        };
      } else if (role === "BDE" && req.user.has_access === false) {
        options.where = {
          ...options.where,
          [Op.and]: [
            where(fn('LOWER', col('adminEmpName')), fn('LOWER', emp_name)),
            { adminbranch: { [Op.in]: allowedBranches } }
          ]
        };
      } else {
        options.where = {
          ...options.where,
          adminbranch: { [Op.in]: allowedBranches }
        };
      }

      // Filter for payments due today
      if (dueToday === "true") {
        const todayDate = new Date().toISOString().split("T")[0];
        options.where[Op.or] = [
          { pendingFeesDate: { [Op.eq]: Sequelize.fn('DATE', todayDate) } },
          { pendingFeesDate2: { [Op.eq]: Sequelize.fn('DATE', todayDate) } },
          { pendingFeesDate3: { [Op.eq]: Sequelize.fn('DATE', todayDate) } },
          { pendingFeesDate4: { [Op.eq]: Sequelize.fn('DATE', todayDate) } },
        ];
      }

      // Filter for pending fees list - shows all students with any pending fees
      if (pendingFeesList === "true") {
        options.where[Op.or] = [
          { pendingFees: { [Op.gt]: 0 } },
          { pendingFees2: { [Op.gt]: 0 } },
          { pendingFees3: { [Op.gt]: 0 } },
          { pendingFees4: { [Op.gt]: 0 } }
        ];
      }

      // Filter for overdue pending fees
      if (pendingFeesOverdue === "true") {
        const todayDate = new Date().toISOString().split("T")[0];
        options.where[Op.or] = [
          {
            [Op.and]: [
              { pendingFees: { [Op.gt]: 0 } },
              { pendingFeesDate: { [Op.lt]: Sequelize.fn('DATE', todayDate) } }
            ]
          },
          {
            [Op.and]: [
              { pendingFees2: { [Op.gt]: 0 } },
              { pendingFeesDate2: { [Op.lt]: Sequelize.fn('DATE', todayDate) } }
            ]
          },
          {
            [Op.and]: [
              { pendingFees3: { [Op.gt]: 0 } },
              { pendingFeesDate3: { [Op.lt]: Sequelize.fn('DATE', todayDate) } }
            ]
          },
          {
            [Op.and]: [
              { pendingFees4: { [Op.gt]: 0 } },
              { pendingFeesDate4: { [Op.lt]: Sequelize.fn('DATE', todayDate) } }
            ]
          }
        ];
      }

      // Filter for today's admissions
      if (todaysAdmission === "true") {
        const todayDate = new Date().toISOString().split("T")[0];
        options.where = {
          ...options.where,
          dateOfAdmission: { [Op.eq]: Sequelize.fn('DATE', todayDate) }
        };
      }

      if (fromDate && toDate) {
        const validFromDate = new Date(fromDate).toISOString().split("T")[0];
        const validToDate = new Date(toDate).toISOString().split("T")[0];

        options.where = {
          ...options.where,
          dateOfAdmission: {
            [Op.between]: [
              Sequelize.fn('DATE', validFromDate),
              Sequelize.fn('DATE', validToDate)
            ]
          }
        };
      }

      // Comprehensive field categorization
      const fieldTypes = {
        stringFields: [
          "name", "contactNo", "course", "batch", "adminbranch", "learningMode",
          "educationLevel", "educationCourse", "department", "studentStatus",
          "courseType", "courseDuration", "classType", "demoGivenBy",
          "registrationPaymentMode", "registrationReferenceNo",
          "adminEmpName", "source", "studentRequestedLocation",
          "studentRequestedBranch", "adminlocation", "staffAssigned", "studentId", "studentProgressStatus"
        ],
        decimalFields: ["courseFees", "feesCollected", "pendingFees", "discountAmount", "pendingFees2", "pendingFees3", "pendingFees4"],
        numericFields: ["id", "placementneeded"],
        dateFields: ["dob", "demoGivenDate", "dateOfAdmission", "pendingFeesDate", "pendingFeesDate2", "pendingFeesDate3", "pendingFeesDate4"]
      };

      // Validate searchField
      if (searchField && !Object.values(fieldTypes).flat().includes(searchField)) {
        return res.status(400).json({ error: "Invalid search field" });
      }

      // Function to handle date searching
      const parseDateSearch = (search) => {
        if (!search || search.trim() === "") return null;

        if (/^\d{1,4}$/.test(search)) {
          const num = parseInt(search, 10);
          return {
            [Op.or]: [
              Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('pendingFeesDate')), num),
              Sequelize.where(Sequelize.fn('MONTH', Sequelize.col('pendingFeesDate')), num),
              Sequelize.where(Sequelize.fn('DAY', Sequelize.col('pendingFeesDate')), num)
            ]
          };
        }

        const fullDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (fullDateRegex.test(search)) {
          return { [Op.eq]: Sequelize.fn('DATE', search) };
        }

        if (/^\d{4}-$/.test(search)) {
          const year = parseInt(search.substring(0, 4), 10);
          return Sequelize.where(
            Sequelize.fn('YEAR', Sequelize.col('pendingFeesDate')),
            year
          );
        }

        if (/^\d{4}-\d{1,2}-?$/.test(search)) {
          const parts = search.split('-');
          const year = parseInt(parts[0], 10);
          const month = parts[1] ? parseInt(parts[1], 10) : null;

          let conditions = [
            Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('pendingFeesDate')), year)
          ];

          if (month !== null) {
            conditions.push(
              Sequelize.where(Sequelize.fn('MONTH', Sequelize.col('pendingFeesDate')), month)
            );
          }

          return { [Op.and]: conditions };
        }

        const partialDateRegex = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/;
        const match = search.match(partialDateRegex);

        if (match) {
          const [, yearStr, monthStr, dayStr] = match;
          let conditions = [];

          if (yearStr) {
            const year = parseInt(yearStr, 10);
            conditions.push(
              Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('pendingFeesDate')), year)
            );
          }

          if (monthStr) {
            const month = parseInt(monthStr, 10);
            conditions.push(
              Sequelize.where(Sequelize.fn('MONTH', Sequelize.col('pendingFeesDate')), month)
            );
          }

          if (dayStr) {
            const day = parseInt(dayStr, 10);
            conditions.push(
              Sequelize.where(Sequelize.fn('DAY', Sequelize.col('pendingFeesDate')), day)
            );
          }

          return conditions.length > 0 ? { [Op.and]: conditions } : null;
        }

        return null;
      };

      // Apply search filter if present
      if (search && searchField) {
        if (fieldTypes.stringFields.includes(searchField)) {
          options.where[searchField] = { [Op.like]: `%${search}%` };
        } else if (fieldTypes.numericFields.includes(searchField)) {
          options.where[searchField] = isNaN(search) ? null : parseInt(search);
        } else if (fieldTypes.decimalFields.includes(searchField)) {
          options.where[searchField] = isNaN(search) ? null : parseFloat(search);
        } else if (fieldTypes.dateFields.includes(searchField)) {
          const dateSearchCondition = parseDateSearch(search);
          if (!dateSearchCondition) {
            return res.status(400).json({ error: "Invalid Date Search", message: `Cannot parse date search: ${search}` });
          }

          if (searchField === "pendingFeesDate" || searchField === "pendingFeesDate2") {
            options.where[Op.or] = [
              { pendingFeesDate: dateSearchCondition },
              { pendingFeesDate2: dateSearchCondition }
            ];
          } else {
            options.where[searchField] = dateSearchCondition;
          }
        }
      }

      if (filters.location && filters.location !== 'All') {
        options.where.adminlocation = filters.location;
      }
      if (filters.branch && filters.branch !== 'All') {
        options.where.adminbranch = filters.branch;
      }
      if (filters.courseType && filters.courseType !== 'All') {
        options.where.courseType = filters.courseType;
      }

      console.log("Final Sequelize WHERE clause:", JSON.stringify(options.where, null, 2));

      // Fetch data
      const { count, rows: registrations } = await StudentRegistration.findAndCountAll(options);

      res.status(200).json({
        totalRegistrations: count,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        registrations,
      });
    } catch (error) {
      console.error("Error fetching student registrations:", error);
      res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
  }
  // Update an existing student registration
  static async updateStudentRegistration(req, res) {
    try {
      // ✅ Extract studentId from request params
      const { studentId } = req.params;
      const updateData = req.body;

      // ✅ Ensure the user is authenticated and retrieve their emp_id
      const { emp_id } = req.user || {};

      if (!emp_id) {
        return res.status(401).json({
          error: 'Unauthorized: Missing user information.',
        });
      }

      console.log("Logged-in User: ", emp_id);

      // ✅ Find the student registration by studentId
      const student = await StudentRegistration.findOne({ where: { studentId } });

      if (!student) {
        return res.status(404).json({
          error: 'Student Registration Not Found',
        });
      }

      // ✅ Add the modified_by field (logged-in user's emp_id)
      updateData.modified_by = emp_id;

      // ✅ Update the student registration
      await student.update(updateData);

      res.status(200).json({
        message: 'Student Registration Updated Successfully',
        student,
      });
    } catch (error) {
      console.error('Error updating student registration:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        details: error.message,
      });
    }
  }

  static async updateStudentRegistrationById(req, res) {
    try {
      const { id } = req.params;
      const { emp_id } = req.user || {};

      if (!emp_id) {
        return res.status(401).json({
          error: 'Unauthorized: Missing user information.',
        });
      }

      const student = await StudentRegistration.findByPk(id);

      if (!student) {
        return res.status(404).json({
          error: 'Student Registration Not Found',
        });
      }

      // ✅ Define only allowed fields to update (excluding email_Id)
      const allowedFields = [
        'name',
        'contactNo',
        'staffAssigned',
        'discountAmount',
        'feesCollected',
        'pendingFees',
        'pendingFees2',
        'pendingFees3',
        'pendingFees4',
        'studentProgressStatus',
        // Add more if needed (but exclude `email_Id`)
      ];

      const updateData = {};

      for (const field of allowedFields) {
        if (req.body.hasOwnProperty(field)) {
          updateData[field] = req.body[field];
        }
      }

      // ✅ Include modifier info
      updateData.modified_by = emp_id;

      await student.update(updateData);

      res.status(200).json({
        message: 'Student Registration Updated Successfully by ID',
        student,
      });
    } catch (error) {
      console.error('Error updating student registration by ID:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        details: error.message,
      });
    }
  }

  static async getPendingDetails(req, res) {
    try {
      const {
        search,
        searchField,
        fromDate,
        toDate,
        branchFilter, // Add branch filter parameter
        dueToday, // Add due today filter parameter
        ...filters
      } = req.query;

      const options = {
        attributes: [
          'studentId',
          'name',
          'contactNo',
          'courseType',
          'course',
          'courseFees',
          'discountAmount',
          'adminEmpName',
          'adminlocation',
          'dateOfAdmission',
          'feesCollected',
          'pendingFees',
          'pendingFees2',
          'pendingFees3',
          'pendingFees4',
          'pendingFeesDate',
          'pendingFeesDate2',
          'pendingFeesDate3',
          'pendingFeesDate4'
        ],
        where: {
          pendingFees: { [Op.gt]: 0 }
        },
        order: orderByStudentIdNumberDesc()
      };

      // Extract allowed branches from user
      const { role, emp_name, branch: allowedBranches } = req.user;

      if (!role || !emp_name) {
        return res.status(403).json({ message: "Access denied: User role or emp_name is missing" });
      }
      if (!allowedBranches || allowedBranches.length === 0) {
        return res.status(403).json({ message: "Access denied: No branch assigned" });
      }

      // Branch code mapping (same as invoice controller)
      const branchCodeMap = {
        "Tambaram": "TM",
        "Velachery": "VL",
        "Vadapalani": "VP",
        "Poonamallee": "PM",
        "Marathahalli": "MH",
        "Gandhipuram": "GP",
        "Malumichampatti": "MP",
        "Hosur": "HS",
        "Saravanampatti": "SP",
        "Tiruppur": "TP",
        "Padi": "PD",
      };

      // Handle branch filtering based on studentId pattern (similar to invoice controller)
      let branchCodes = [];
      if (branchFilter && branchFilter !== 'all') {
        const branchCode = branchCodeMap[branchFilter];
        if (branchCode) {
          branchCodes = [branchCode];
        }
      } else {
        branchCodes = allowedBranches
          .map(name => branchCodeMap[name])
          .filter(Boolean);
      }

      // Apply branch filtering using studentId pattern
      if (branchCodes.length > 0) {
        options.where.studentId = {
          [Op.or]: branchCodes.map(code => ({
            [Op.like]: `%-${code}-%`,
          })),
        };
      }

      // Apply role-based filtering
      if (role === "Trainer") {
        options.where.staffAssigned = emp_name;
      } else if (role === "BDE" && req.user.has_access === false) {
        options.where.adminEmpName = emp_name;
      } else {
        // Keep the existing adminbranch filter for backward compatibility
        // but it will work together with the studentId branch filter above
        options.where.adminbranch = { [Op.in]: allowedBranches };
      }

      // Filter for payments due today
      if (dueToday === "true") {
        const todayDate = new Date().toISOString().split("T")[0]; // Get YYYY-MM-DD format

        // Create an array to hold due today conditions
        const dueTodayConditions = [
          { pendingFeesDate: { [Op.eq]: Sequelize.fn('DATE', todayDate) } },
          { pendingFeesDate2: { [Op.eq]: Sequelize.fn('DATE', todayDate) } },
          { pendingFeesDate3: { [Op.eq]: Sequelize.fn('DATE', todayDate) } },
          { pendingFeesDate4: { [Op.eq]: Sequelize.fn('DATE', todayDate) } },
        ];

        // If there are already OR conditions in the where clause, combine them
        if (options.where[Op.or]) {
          options.where[Op.and] = [
            { [Op.or]: options.where[Op.or] },
            { [Op.or]: dueTodayConditions }
          ];
          delete options.where[Op.or];
        } else {
          options.where[Op.or] = dueTodayConditions;
        }
      }

      // Date range filter
      if (fromDate && toDate) {
        const validFromDate = new Date(fromDate).toISOString().split("T")[0];
        const validToDate = new Date(toDate).toISOString().split("T")[0];
        options.where.dateOfAdmission = {
          [Op.between]: [
            Sequelize.fn('DATE', validFromDate),
            Sequelize.fn('DATE', validToDate)
          ]
        };
      }

      // Search functionality
      if (search && searchField) {
        const stringFields = ['studentId', 'name', 'contactNo', 'courseType', 'course', 'adminEmpName', 'adminlocation'];
        const numericFields = ['courseFees', 'discountAmount', 'feesCollected', 'pendingFees'];
        const dateFields = ['dateOfAdmission', 'pendingFeesDate'];

        if (stringFields.includes(searchField)) {
          // Handle search term with existing studentId filter
          if (searchField === 'studentId' && options.where.studentId) {
            const existingStudentIdFilter = options.where.studentId;
            options.where[Op.and] = [
              { studentId: existingStudentIdFilter },
              { studentId: { [Op.like]: `%${search}%` } }
            ];
            delete options.where.studentId;
          } else {
            options.where[searchField] = { [Op.like]: `%${search}%` };
          }
        } else if (numericFields.includes(searchField)) {
          const numValue = parseFloat(search);
          if (!isNaN(numValue)) {
            options.where[searchField] = numValue;
          }
        } else if (dateFields.includes(searchField)) {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (dateRegex.test(search)) {
            options.where[searchField] = { [Op.eq]: Sequelize.fn('DATE', search) };
          }
        }
      }

      // Additional filters
      if (filters.location && filters.location !== 'All') {
        options.where.adminlocation = filters.location;
      }
      if (filters.branch && filters.branch !== 'All') {
        options.where.adminbranch = filters.branch;
      }
      if (filters.courseType && filters.courseType !== 'All') {
        options.where.courseType = filters.courseType;
      }

      console.log("Pending Details WHERE clause:", JSON.stringify(options.where, null, 2));

      // Fetch all matching data without pagination
      const pendingDetails = await StudentRegistration.findAll(options);

      res.status(200).json({
        totalRecords: pendingDetails.length,
        pendingDetails
      });

    } catch (error) {
      console.error("Error fetching pending details:", error);
      res.status(500).json({
        error: "Internal Server Error",
        details: error.message
      });
    }
  }

  static async getStudentsForPlacement(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        searchField,
        ...filters
      } = req.query;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);

      const options = {
        where: {
          studentProgressStatus: 'Course Completed',
          placementneeded: 'Yes'
        },
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
        order: orderByStudentIdNumberDesc()
      };

      const { role, emp_name, branch: allowedBranches } = req.user;

      if (!role || !emp_name) {
        return res.status(403).json({ message: "Access denied: User role or emp_name is missing" });
      }

      if (!allowedBranches || allowedBranches.length === 0) {
        return res.status(403).json({ message: "Access denied: No branch assigned" });
      }

      // Branch-based access control
      if (role === "Trainer") {
        options.where.staffAssigned = emp_name;
      } else if (role === "BDE" && req.user.has_access === false) {
        options.where.adminEmpName = emp_name;
      } else {
        options.where.adminbranch = { [Op.in]: allowedBranches };
      }

      // Apply search if provided
      if (search && searchField) {
        const stringFields = [
          "name", "contactNo", "course", "batch", "adminbranch", "learningMode",
          "educationLevel", "educationCourse", "department", "studentStatus",
          "courseType", "courseDuration", "classType", "demoGivenBy",
          "adminEmpName", "source", "studentRequestedLocation",
          "studentRequestedBranch", "adminlocation", "staffAssigned", "studentId"
        ];

        if (stringFields.includes(searchField)) {
          options.where[searchField] = { [Op.like]: `%${search}%` };
        }
      }

      // Optional: handle branch/location/courseType filters
      if (filters.branch && filters.branch !== "All") {
        options.where.adminbranch = filters.branch;
      }
      if (filters.location && filters.location !== "All") {
        options.where.adminlocation = filters.location;
      }
      if (filters.courseType && filters.courseType !== "All") {
        options.where.courseType = filters.courseType;
      }

      const { count, rows: students } = await StudentRegistration.findAndCountAll(options);

      res.status(200).json({
        totalStudents: count,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        students
      });

    } catch (error) {
      console.error("Error fetching students for placement:", error);
      res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
  }

  static async studentLogin(req, res) {
    try {
      const email = req.body.email_Id || req.body.email_id;
      const password = req.body.password;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      // Find student
      const student = await StudentRegistration.findOne({
        where: { email_Id: email },
        attributes: [
          "id", "studentId", "name", "email_Id", "contactNo", "ParentNo",
          "address", "educationLevel", "department", "clg_name",
          "educationCourse", "studentStatus", "dob", "studentRequirement",
          "courseType", "course", "adminlocation", "adminbranch",
          "profilePicPath", "staffAssigned", "placementneeded",
          "password", "lastLogin"
        ]
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found with this email",
        });
      }

      // Fetch course details once
      const courseDetails = await StudentCourse.findOne({
        where: { studentId: student.studentId }
      });

      // FIRST TIME LOGIN
      if (!student.password) {

        if (student.studentId !== password) {
          return res.status(401).json({
            success: false,
            message: "Invalid student ID",
          });
        }

        // update last login
        await student.update({ lastLogin: new Date() });

        return res.status(200).json({
          success: true,
          message: "First time login - password setup required",
          student: {
            ...student.toJSON(),
            courseDetails: courseDetails ? courseDetails.toJSON() : null
          },
          requirePasswordSetup: true
        });
      }

      // NORMAL LOGIN
      const isPasswordValid = await bcrypt.compare(password, student.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid password",
        });
      }

      // Update last login
      await student.update({ lastLogin: new Date() });

      // Generate token
      const token = jwt.sign(
        {
          studentId: student.studentId,
          name: student.name,
          email_Id: student.email_Id,
          course: student.course,
          courseType: student.courseType,
          userType: "student"
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const response = {
        ...student.toJSON(),
        courseDetails: courseDetails ? courseDetails.toJSON() : null
      };

      delete response.password;

      return res.status(200).json({
        success: true,
        message: "Login successful",
        student: response,
        token,
        requirePasswordSetup: false
      });

    } catch (error) {
      console.error("Student login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
  // Password setup controller remains the same
  static async setupPassword(req, res) {
    try {
      const { studentId, newPassword, confirmPassword } = req.body;

      if (!studentId || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Student ID, new password and confirm password are required',
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password and confirm password do not match',
        });
      }

      // Password validation
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 number and 1 special character',
        });
      }

      // Find student
      const student = await StudentRegistration.findOne({
        where: { studentId: studentId }
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found',
        });
      }

      // Check if password is already set
      if (student.password) {
        return res.status(400).json({
          success: false,
          message: 'Password is already set for this student',
        });
      }

      // Hash the new password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update student password
      await StudentRegistration.update(
        { password: hashedPassword },
        { where: { studentId: studentId } }
      );

      res.status(200).json({
        success: true,
        message: 'Password set successfully. Please login with your new password.',
      });

    } catch (error) {
      console.error('Password setup error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }
  static async resetStudentToDefaultPassword(req, res) {
    try {
      const { email_Id, studentId } = req.body;

      // Ensure only Super-Admin or Branch-Head can call this
      if (!req.user || !["Super-Admin", "Branch-Head"].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Super-Admins and Branch-Heads only"
        });
      }

      // Validate input - need either email or studentId
      if (!email_Id && !studentId) {
        return res.status(400).json({
          success: false,
          message: "Email or Student ID is required"
        });
      }

      // Build where condition based on provided input
      let whereCondition = {};
      if (email_Id) {
        whereCondition.email_Id = email_Id;
      } else {
        whereCondition.studentId = studentId;
      }

      const student = await StudentRegistration.findOne({
        where: whereCondition,
        attributes: ['studentId', 'email_Id', 'name', 'contactNo']
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found"
        });
      }

      // Reset password to null (so they use studentId as password on next login)
      await StudentRegistration.update(
        {
          password: null, // Reset to null - forces first-time login flow
        },
        { where: { studentId: student.studentId } }
      );

      res.status(200).json({
        success: true,
        message: "Student password reset to default successfully. Student will use Student ID as password on next login.",
        student: {
          studentId: student.studentId,
          email_Id: student.email_Id,
          name: student.name
        },
        resetInfo: {
          defaultPassword: student.studentId, // Student ID is the default password
          requiresPasswordSetup: true
        }
      });

    } catch (error) {
      console.error("Student default password reset error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  }
  // StudentRegistrationController.js - Updated updateStudentProfile method
  static async updateStudentProfile(req, res) {
    try {
      const { studentId } = req.params;

      const {
        name,
        email_Id,
        contactNo,
        ParentNo,
        address,
        educationLevel,
        department,
        clg_name,
        educationCourse,
        studentStatus,
        dob,
        studentRequirement,
        desiredlocation,
        gender,
        tenthPassout,
        tenthPercentage,
        tenthInstitution,
        tenthDepartment,
        tenthDegree,
        twelfthPassout,
        twelfthPercentage,
        twelfthInstitution,
        twelfthDepartment,
        twelfthDegree,
        diplomaInstitution,
        diplomaDepartment,
        diplomaDegree,
        diplomaPassout,
        diplomaPercentage,
        ugInstitution,
        ugDepartment,
        ugDegree,
        ugPassout,
        ugPercentage,
        pgInstitution,
        pgDepartment,
        pgDegree,
        pgPassout,
        pgPercentage,
        collegePassout,
        cgpa,
        Department,
        knownSkill,
        skillSet,

        // Experience fields
        experience,
        expCompanyName1, expStartDate1, expEndDate1, expRole1, expTechnologies1, expCurrentlyWorking1,
        expCompanyName2, expStartDate2, expEndDate2, expRole2, expTechnologies2, expCurrentlyWorking2,
        expCompanyName3, expStartDate3, expEndDate3, expRole3, expTechnologies3, expCurrentlyWorking3

      } = req.body;

      const updatedBy = 'student';

      // Authorization check
      if (req.student && req.student.studentId !== studentId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update your own profile'
        });
      }

      // Get current course data
      const currentRecord = await StudentCourse.findOne({ where: { studentId } });
      if (!currentRecord) {
        return res.status(404).json({ success: false, message: 'Student not found.' });
      }

      // Skill update detection
      const currentKnownSkills = currentRecord.knownSkill || "";
      const newKnownSkills = Array.isArray(knownSkill)
        ? knownSkill.join(",")
        : (knownSkill || "");

      const skillsChanged = currentKnownSkills !== newKnownSkills;

      // Update StudentRegistration table
      await StudentRegistration.update({
        name,
        email_Id,
        contactNo,
        ParentNo,
        address,
        educationLevel,
        department,
        clg_name,
        educationCourse,
        studentStatus,
        dob,
        studentRequirement
      }, { where: { studentId } });

      // =======================
      // BUILD StudentCourse UPDATE DATA
      // =======================

      const courseUpdateData = {
        studentName: name,
        email_Id,
        studentContactNumber: contactNo,
        educationQualification: educationLevel,
        clgName: clg_name,
        gender,
        tenthPassout,
        tenthPercentage,
        tenthInstitution,
        tenthDepartment,
        tenthDegree,
        twelfthPassout,
        twelfthPercentage,
        twelfthInstitution,
        twelfthDepartment,
        twelfthDegree,
        diplomaInstitution,
        diplomaDepartment,
        diplomaDegree,
        diplomaPassout,
        diplomaPercentage,
        ugInstitution,
        ugDepartment,
        ugDegree,
        ugPassout,
        ugPercentage,
        pgInstitution,
        pgDepartment,
        pgDegree,
        pgPassout,
        pgPercentage,
        collegePassout,
        cgpa,
        desiredlocation: Array.isArray(desiredlocation)
          ? desiredlocation.join(",")
          : (desiredlocation || ""),
        skillSet: Array.isArray(skillSet)
          ? skillSet.join(",")
          : (skillSet || ""),
        Department,
        experience,

        // ========= EXPERIENCE ROW 1 =========
        expCompanyName1,
        expStartDate1: expStartDate1 || null,
        expEndDate1: expCurrentlyWorking1 ? null : (expEndDate1 || null),
        expRole1,
        expTechnologies1,
        expCurrentlyWorking1,

        // ========= EXPERIENCE ROW 2 =========
        expCompanyName2,
        expStartDate2: expStartDate2 || null,
        expEndDate2: expCurrentlyWorking2 ? null : (expEndDate2 || null),
        expRole2,
        expTechnologies2,
        expCurrentlyWorking2,

        // ========= EXPERIENCE ROW 3 =========
        expCompanyName3,
        expStartDate3: expStartDate3 || null,
        expEndDate3: expCurrentlyWorking3 ? null : (expEndDate3 || null),
        expRole3,
        expTechnologies3,
        expCurrentlyWorking3,

        modified_by: req.student?.studentId
      };

      // Handle SKILL APPROVAL LOGIC
      if (skillsChanged) {
        courseUpdateData.knownSkill = newKnownSkills;
        courseUpdateData.lastSkillUpdateBy = updatedBy;
        courseUpdateData.skillUpdateTimestamp = new Date();
        courseUpdateData.stuapprove = true;
        courseUpdateData.staffapprove = false;
      }

      // Save to StudentCourse
      await StudentCourse.update(courseUpdateData, { where: { studentId } });

      return res.status(200).json({
        success: true,
        message: skillsChanged
          ? 'Student profile updated successfully. Skills are pending staff approval.'
          : 'Student profile updated successfully.',
        skillsChanged,
        updatedBy,
        updatedFields: skillsChanged
          ? {
            skillSet: courseUpdateData.skillSet,
            knownSkill: courseUpdateData.knownSkill,
            stuapprove: courseUpdateData.stuapprove,
            staffapprove: courseUpdateData.staffapprove
          }
          : null
      });

    } catch (error) {
      console.error('Student profile update error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  static async approveSkills(req, res) {
    try {
      const { studentId, id } = req.params; // studentId from student route, id from staff route
      const recordId = studentId || id; // Use whichever is provided
      const { approved, updatedBy } = req.body;

      console.log('Skill approval request:', {
        recordId,
        approved,
        updatedBy,
        userType: req.user ? 'staff' : req.student ? 'student' : 'unknown',
        staffInfo: req.user ? { emp_id: req.user.emp_id, role: req.user.role } : null,
        studentInfo: req.student ? { studentId: req.student.studentId } : null
      });

      // ✅ Authorization checks
      if (updatedBy === 'student' && req.student) {
        // Student can only approve their own profile
        if (req.student.studentId !== recordId) {
          return res.status(403).json({
            success: false,
            message: 'Students can only approve their own profile'
          });
        }
      }

      // ✅ Find the record - try by studentId first, then by id
      let whereClause = {};
      if (studentId) {
        whereClause = { studentId: recordId };
      } else {
        whereClause = { id: recordId };
      }

      const existingRecord = await StudentCourse.findOne({ where: whereClause });

      if (!existingRecord) {
        return res.status(404).json({
          success: false,
          message: 'Student record not found'
        });
      }

      // ✅ Staff approval logic - allow ANY staff (remove mentor restriction)
      if (updatedBy === 'staff' && req.user) {
        console.log('Staff approval allowed for any staff:', {
          emp_id: req.user.emp_id,
          role: req.user.role
        });
      }

      // ✅ Build update data
      let updateData = {
        skillUpdateTimestamp: new Date()
      };

      if (updatedBy === 'student') {
        // Student is approving staff's skill updates
        updateData.stuapprove = approved;
        console.log('Student approval:', { stuapprove: approved });
      } else if (updatedBy === 'staff') {
        // Staff is approving student's skill updates
        updateData.staffapprove = approved;
        console.log('Staff approval:', { staffapprove: approved });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid updatedBy value. Must be "student" or "staff"'
        });
      }

      // ✅ Perform update
      const [updatedRows] = await StudentCourse.update(updateData, {
        where: whereClause
      });

      if (updatedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Failed to update approval status'
        });
      }

      // ✅ Get updated record for response
      const updatedRecord = await StudentCourse.findOne({
        where: whereClause,
        attributes: ['stuapprove', 'staffapprove', 'skillUpdateTimestamp', 'lastSkillUpdateBy']
      });

      return res.status(200).json({
        success: true,
        message: approved ? 'Skills approved successfully' : 'Skills rejected successfully',
        approvalType: updatedBy,
        approved,
        currentStatus: {
          stuapprove: updatedRecord.stuapprove,
          staffapprove: updatedRecord.staffapprove,
          lastSkillUpdateBy: updatedRecord.lastSkillUpdateBy,
          skillUpdateTimestamp: updatedRecord.skillUpdateTimestamp
        }
      });

    } catch (error) {
      console.error('Skill approval error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  static async getStudentById(req, res) {
    try {
      const { studentId } = req.params;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required',
        });
      }

      // Find student details from StudentRegistration
      const student = await StudentRegistration.findOne({
        where: { studentId },
        attributes: [
          'studentId',
          'name',
          'email_Id',
          'contactNo',
          'ParentNo',
          'address',
          'educationLevel',
          'department',
          'clg_name',
          'educationCourse',
          'studentStatus',
          'dob',
          'studentRequirement',
          'courseType',
          'course',
          'adminlocation',
          'adminbranch',
          'profilePicPath',
          'resumePath',
          'staffAssigned',
          'placementneeded'
        ]
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found with this ID',
        });
      }

      // Fetch course details from StudentCourse
      const courseDetails = await StudentCourse.findOne({
        where: { studentId: student.studentId },
        attributes: [
          'courseStartDate',
          'courseEndDate',
          'mockTest1Score',
          'mockTest2Score',
          'mockTest3Score',
          'technicalScore',
          'communicationScore',
          'technologyRemarks',
          'communicationRemarks',
          'project1Feedback',
          'project2Feedback',
          'project3Feedback',
          'mockInterview',
          'mockRemarks',
          'project1Score',
          'project2Score',
          'project3Score',
          'projectTitle1',
          'projectTitle2',
          'projectTitle3',
          'project1Status',
          'project2Status',
          'project3Status',
          'desiredlocation',
          'gender',
          'tenthPassout',
          'tenthPercentage',
          'tenthInstitution',
          'tenthDepartment',
          'tenthDegree',
          'twelfthPassout',
          'twelfthPercentage',
          'twelfthInstitution',
          'twelfthDepartment',
          'twelfthDegree',
          'diplomaInstitution',
          'diplomaDepartment',
          'diplomaDegree',
          'diplomaPassout',
          'diplomaPercentage',
          'ugInstitution',
          'ugDepartment',
          'ugDegree',
          'ugPassout',
          'ugPercentage',
          'pgInstitution',
          'pgDepartment',
          'pgDegree',
          'pgPassout',
          'pgPercentage',
          'collegePassout',
          'cgpa',
          'Department',
          'skillSet',
          'knownSkill',
          'mentor',
          'mentorid',
          'mentorNumber',
          'placementStatus',
          'companyName',
          'companyLocation',
          'joiningDate',
          'jobRole',
          'placedBy',
          'package',
          'placementDate',
          'experience',
          'placementInterest',
          'staffRemarks',
          'expCompanyName1', 'expStartDate1', 'expEndDate1', 'expRole1', 'expTechnologies1', 'expCurrentlyWorking1',
          'expCompanyName2', 'expStartDate2', 'expEndDate2', 'expRole2', 'expTechnologies2', 'expCurrentlyWorking2',
          'expCompanyName3', 'expStartDate3', 'expEndDate3', 'expRole3', 'expTechnologies3', 'expCurrentlyWorking3'

        ]
      });

      // Combine data
      const response = {
        ...student.toJSON(),
        courseDetails: courseDetails ? courseDetails.toJSON() : null
      };

      res.status(200).json({
        success: true,
        message: 'Student data retrieved successfully',
        student: response
      });

    } catch (error) {
      console.error('Get student error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }

  static async getStudentProfilePic(req, res) {
    try {
      const { studentId } = req.params;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required',
        });
      }

      // Fetch only the profile picture path
      const student = await StudentRegistration.findOne({
        where: { studentId },
        attributes: ['profilePicPath'],
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found with this ID',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Profile picture path retrieved successfully',
        profilePicPath: student.profilePicPath,
      });
    } catch (error) {
      console.error('Error fetching profile picture:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }
  static async getStudentResume(req, res) {
    try {
      const { studentId } = req.params;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required',
        });
      }

      // Find only the resumePath field
      const student = await StudentRegistration.findOne({
        where: { studentId },
        attributes: ['studentId', 'resumePath'],
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found with this ID',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Resume path retrieved successfully',
        resumePath: student.resumePath,
      });
    } catch (error) {
      console.error('Error fetching student resume:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  }
  static async saveFcmToken(req, res) {

    try {
      console.log("BODY:", req.body);
      const { token, deviceType } = req.body;

      const studentId = req.student.studentId;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Token required"
        });
      }

      await StudentDeviceToken.findOrCreate({
        where: { token },
        defaults: {
          studentId,
          token,
          deviceType
        }
      });

      return res.json({
        success: true,
        message: "Device token saved"
      });

    } catch (error) {

      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Server error"
      });

    }

  }
  // New controller for completed students with no pending fees
  static async getCompletedStudentsWithNoPendingFees(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        searchField,
        fromDate,
        toDate,
        ...filters
      } = req.query;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);

      const completionStatuses = [
        'Course Completed',
        'Course and Certified Completed',
        'Course Completed, Certified, and Successfully Placed'
      ];

      const options = {
        where: {
          // Filter for specific completion statuses
          studentProgressStatus: { [Op.in]: completionStatuses },
          // Ensure all pending fees are 0 or null
          [Op.and]: [
            {
              [Op.or]: [
                { pendingFees: { [Op.eq]: 0 } },
                { pendingFees: { [Op.is]: null } }
              ]
            },
            {
              [Op.or]: [
                { pendingFees2: { [Op.eq]: 0 } },
                { pendingFees2: { [Op.is]: null } }
              ]
            },
            {
              [Op.or]: [
                { pendingFees3: { [Op.eq]: 0 } },
                { pendingFees3: { [Op.is]: null } }
              ]
            },
            {
              [Op.or]: [
                { pendingFees4: { [Op.eq]: 0 } },
                { pendingFees4: { [Op.is]: null } }
              ]
            }
          ]
        },
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
        order: orderByStudentIdNumberDesc()
      };

      // Extract allowed branches from user
      const { role, emp_name, branch: allowedBranches } = req.user;

      if (!role || !emp_name) {
        return res.status(403).json({ message: "Access denied: User role or emp_name is missing" });
      }
      if (!allowedBranches || allowedBranches.length === 0) {
        return res.status(403).json({ message: "Access denied: No branch assigned" });
      }

      // Apply role-based filtering
      if (role === "Trainer") {
        options.where = {
          ...options.where,
          [Op.and]: [
            ...options.where[Op.and],
            where(fn('LOWER', col('staffAssigned')), fn('LOWER', emp_name)),
            { adminbranch: { [Op.in]: allowedBranches } }
          ]
        };
      } else if (role === "BDE" && req.user.has_access === false) {
        options.where = {
          ...options.where,
          [Op.and]: [
            ...options.where[Op.and],
            where(fn('LOWER', col('adminEmpName')), fn('LOWER', emp_name)),
            { adminbranch: { [Op.in]: allowedBranches } }
          ]
        };
      } else {
        options.where = {
          ...options.where,
          adminbranch: { [Op.in]: allowedBranches }
        };
      }

      // Date range filter
      if (fromDate && toDate) {
        const validFromDate = new Date(fromDate).toISOString().split("T")[0];
        const validToDate = new Date(toDate).toISOString().split("T")[0];

        options.where = {
          ...options.where,
          dateOfAdmission: {
            [Op.between]: [
              Sequelize.fn('DATE', validFromDate),
              Sequelize.fn('DATE', validToDate)
            ]
          }
        };
      }

      // Comprehensive field categorization (same as original)
      const fieldTypes = {
        stringFields: [
          "name", "contactNo", "course", "batch", "adminbranch", "learningMode",
          "educationLevel", "educationCourse", "department", "studentStatus",
          "courseType", "courseDuration", "classType", "demoGivenBy",
          "registrationPaymentMode", "registrationReferenceNo",
          "adminEmpName", "source", "studentRequestedLocation",
          "studentRequestedBranch", "adminlocation", "staffAssigned", "studentId",
          "studentProgressStatus"
        ],
        decimalFields: ["courseFees", "feesCollected", "pendingFees", "discountAmount", "pendingFees2", "pendingFees3", "pendingFees4"],
        numericFields: ["id", "placementneeded"],
        dateFields: ["dob", "demoGivenDate", "dateOfAdmission", "pendingFeesDate", "pendingFeesDate2", "pendingFeesDate3", "pendingFeesDate4"]
      };

      // Validate searchField
      if (searchField && !Object.values(fieldTypes).flat().includes(searchField)) {
        return res.status(400).json({ error: "Invalid search field" });
      }

      // Apply search filter if present (same logic as original)
      if (search && searchField) {
        if (fieldTypes.stringFields.includes(searchField)) {
          options.where[searchField] = { [Op.like]: `%${search}%` };
        } else if (fieldTypes.numericFields.includes(searchField)) {
          options.where[searchField] = isNaN(search) ? null : parseInt(search);
        } else if (fieldTypes.decimalFields.includes(searchField)) {
          options.where[searchField] = isNaN(search) ? null : parseFloat(search);
        } else if (fieldTypes.dateFields.includes(searchField)) {
          // Use the same parseDateSearch function from original controller
          const parseDateSearch = (search) => {
            if (!search || search.trim() === "") return null;

            if (/^\d{1,4}$/.test(search)) {
              const num = parseInt(search, 10);
              return {
                [Op.or]: [
                  Sequelize.where(Sequelize.fn('YEAR', Sequelize.col(searchField)), num),
                  Sequelize.where(Sequelize.fn('MONTH', Sequelize.col(searchField)), num),
                  Sequelize.where(Sequelize.fn('DAY', Sequelize.col(searchField)), num)
                ]
              };
            }

            const fullDateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (fullDateRegex.test(search)) {
              return { [Op.eq]: Sequelize.fn('DATE', search) };
            }

            const partialDateRegex = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/;
            const match = search.match(partialDateRegex);

            if (match) {
              const [, yearStr, monthStr, dayStr] = match;
              let conditions = [];

              if (yearStr) {
                conditions.push(
                  Sequelize.where(Sequelize.fn('YEAR', Sequelize.col(searchField)), parseInt(yearStr, 10))
                );
              }
              if (monthStr) {
                conditions.push(
                  Sequelize.where(Sequelize.fn('MONTH', Sequelize.col(searchField)), parseInt(monthStr, 10))
                );
              }
              if (dayStr) {
                conditions.push(
                  Sequelize.where(Sequelize.fn('DAY', Sequelize.col(searchField)), parseInt(dayStr, 10))
                );
              }

              return conditions.length > 0 ? { [Op.and]: conditions } : null;
            }

            return null;
          };

          const dateSearchCondition = parseDateSearch(search);
          if (!dateSearchCondition) {
            return res.status(400).json({ error: "Invalid Date Search", message: `Cannot parse date search: ${search}` });
          }
          options.where[searchField] = dateSearchCondition;
        }
      }

      // Additional filters
      if (filters.location && filters.location !== 'All') {
        options.where.adminlocation = filters.location;
      }
      if (filters.branch && filters.branch !== 'All') {
        options.where.adminbranch = filters.branch;
      }
      if (filters.courseType && filters.courseType !== 'All') {
        options.where.courseType = filters.courseType;
      }

      console.log("Completed Students WHERE clause:", JSON.stringify(options.where, null, 2));

      // Fetch data
      const { count, rows: completedStudents } = await StudentRegistration.findAndCountAll(options);

      res.status(200).json({
        totalStudents: count,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        completedStudents,
        message: "Students with completed status and no pending fees"
      });
    } catch (error) {
      console.error("Error fetching completed students:", error);
      res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
  }
  // Ensure your route uses studentId
}

module.exports = StudentRegistrationController;

