const { Op, Sequelize } = require('sequelize');
const StudentRegistration = require('../models/studenReg');
const sequelize = require('../config/database');

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
  "Saravanampatti":"SP",
  "Tiruppur":"TP",
  "Padi":"PD",
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
      const { preview } = req.query; // Flag to check if we only need the next ID

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Generate next studentId logic with course type included
      const generateNextId = async (branch, courseType) => {
        const branchAbbr = getBranchAbbreviation(branch);
        const courseAbbr = getCourseTypeAbbreviation(courseType || 'Course');
      
        // Get ALL students from this branch to manually find highest number
        const branchPattern = `%-${branchAbbr}-%`;
        
        const allBranchStudents = await StudentRegistration.findAll({
          where: { studentId: { [Op.like]: branchPattern } },
          attributes: ['studentId'],
          raw: true
        });
        
        // Find the highest number across all course types
        let highestNumber = 1000; // Start at 1000, so first will be 1001
        
        if (allBranchStudents.length > 0) {
          allBranchStudents.forEach(student => {
            const parts = student.studentId.split('-');
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

      // CASE 1: Only preview next ID (called when branch is selected)
      if (preview === 'true') {
        if (!studentData.adminbranch) {
          return res.status(400).json({ message: 'Admin branch is required for ID generation' });
        }
        
        // Use the provided course type or default to "Course"
        const courseType = studentData.courseType || 'Course';
        const nextId = await generateNextId(studentData.adminbranch, courseType);
        
        return res.json({ nextId });
      }

      // CASE 2: Actual registration (existing logic with updated ID generation)
      const { contactNo, course, adminbranch, courseType } = studentData;
      if (!contactNo || !course || !adminbranch) {
        return res.status(400).json({
          message: 'Contact number, course, and admin branch are required.',
        });
      }

      // Generate student ID with course type
      const studentId = await generateNextId(adminbranch, courseType || 'Course');
      studentData.studentId = studentId;
      studentData.modified_by = user.emp_id;

      const newRegistration = await StudentRegistration.create(studentData);

      res.status(201).json({
        message: 'Registration successful',
        student: newRegistration
      });

    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
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
        pendingFeesList, // New parameter for pending fees filter
        fromDate,
        toDate,
        ...filters
      } = req.query;
  
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
  
      const options = {
        where: {},
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
        order: [
          [Sequelize.literal(`CAST(SUBSTRING("studentId" FROM '[0-9]+$') AS INTEGER)`), 'DESC']
        ]
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
        options.where.staffAssigned = emp_name;
      } else if (role === "BDE" && req.user.has_access === false) {
        options.where.adminEmpName = emp_name;
      } else {
        options.where.adminbranch = { [Op.in]: allowedBranches };
      }
  
      // Filter for payments due today
      if (dueToday === "true") {
        const todayDate = new Date().toISOString().split("T")[0]; // Get YYYY-MM-DD format
        options.where[Op.or] = [
          { pendingFeesDate: { [Op.eq]: Sequelize.literal(`'${todayDate}'::date`) } },
          { pendingFeesDate2: { [Op.eq]: Sequelize.literal(`'${todayDate}'::date`) } },
          { pendingFeesDate3: { [Op.eq]: Sequelize.literal(`'${todayDate}'::date`) } },
          { pendingFeesDate4: { [Op.eq]: Sequelize.literal(`'${todayDate}'::date`) } },
        ];
      }
  
      // NEW: Filter for pending fees list - shows all students with any pending fees
      if (pendingFeesList === "true") {
        options.where[Op.or] = [
          { pendingFees: { [Op.gt]: 0 } },
          { pendingFees2: { [Op.gt]: 0 } },
          { pendingFees3: { [Op.gt]: 0 } },
          { pendingFees4: { [Op.gt]: 0 } }
        ];
      }
  
      // Filter for today's admissions
      if (todaysAdmission === "true") {
        const todayDate = new Date().toISOString().split("T")[0];
        options.where = {
          ...options.where,
          dateOfAdmission: { [Op.eq]: Sequelize.literal(`'${todayDate}'::date`) }
        };
      }
  
      if (fromDate && toDate) {
        // Ensure dates are properly formatted
        const validFromDate = new Date(fromDate).toISOString().split("T")[0];
        const validToDate = new Date(toDate).toISOString().split("T")[0];
        
        // Add date range filter to the query
        options.where = {
          ...options.where,
          dateOfAdmission: { 
            [Op.between]: [
              Sequelize.literal(`'${validFromDate}'::date`),
              Sequelize.literal(`'${validToDate}'::date`)
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
          "studentRequestedBranch", "adminlocation", "staffAssigned", "studentId",
        ],
        decimalFields: ["courseFees", "feesCollected", "pendingFees", "discountAmount", "pendingFees2","pendingFees3","pendingFees4"],
        numericFields: ["id", "placementneeded"],
        dateFields: ["dob", "demoGivenDate", "dateOfAdmission", "pendingFeesDate", "pendingFeesDate2","pendingFeesDate3","pendingFeesDate4"]
      };
  
      // Validate searchField
      if (searchField && !Object.values(fieldTypes).flat().includes(searchField)) {
        return res.status(400).json({ error: "Invalid search field" });
      }
  
      // Function to handle date searching - improved version
      const parseDateSearch = (search) => {
        if (!search || search.trim() === "") return null;
  
        // Handle simple year, month, or day search (single numbers)
        if (/^\d{1,4}$/.test(search)) {
          const num = parseInt(search, 10);
          return {
            [Op.or]: [
              Sequelize.where(Sequelize.fn('extract', Sequelize.literal('year from "pendingFeesDate"')), num),
              Sequelize.where(Sequelize.fn('extract', Sequelize.literal('month from "pendingFeesDate"')), num),
              Sequelize.where(Sequelize.fn('extract', Sequelize.literal('day from "pendingFeesDate"')), num)
            ]
          };
        }
  
        // Complete date format (YYYY-MM-DD)
        const fullDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (fullDateRegex.test(search)) {
          return { [Op.eq]: Sequelize.literal(`'${search}'::date`) };
        }
  
        // Handle partial date formats
        let year, month, day;
        
        // Year only (YYYY-)
        if (/^\d{4}-$/.test(search)) {
          year = parseInt(search.substring(0, 4), 10);
          return Sequelize.where(
            Sequelize.fn('extract', Sequelize.literal('year from "pendingFeesDate"')),
            year
          );
        }
        
        // Year and month (YYYY-MM-)
        if (/^\d{4}-\d{1,2}-?$/.test(search)) {
          const parts = search.split('-');
          year = parseInt(parts[0], 10);
          month = parts[1] ? parseInt(parts[1], 10) : null;
          
          let conditions = [
            Sequelize.where(Sequelize.fn('extract', Sequelize.literal('year from "pendingFeesDate"')), year)
          ];
          
          if (month !== null) {
            conditions.push(
              Sequelize.where(Sequelize.fn('extract', Sequelize.literal('month from "pendingFeesDate"')), month)
            );
          }
          
          return { [Op.and]: conditions };
        }
        
        // Partial date with some components (handles various formats more flexibly)
        const partialDateRegex = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/;
        const match = search.match(partialDateRegex);
        
        if (match) {
          const [, yearStr, monthStr, dayStr] = match;
          let conditions = [];
          
          if (yearStr) {
            year = parseInt(yearStr, 10);
            conditions.push(
              Sequelize.where(Sequelize.fn('extract', Sequelize.literal('year from "pendingFeesDate"')), year)
            );
          }
          
          if (monthStr) {
            month = parseInt(monthStr, 10);
            conditions.push(
              Sequelize.where(Sequelize.fn('extract', Sequelize.literal('month from "pendingFeesDate"')), month)
            );
          }
          
          if (dayStr) {
            day = parseInt(dayStr, 10);
            conditions.push(
              Sequelize.where(Sequelize.fn('extract', Sequelize.literal('day from "pendingFeesDate"')), day)
            );
          }
          
          return conditions.length > 0 ? { [Op.and]: conditions } : null;
        }
  
        return null;
      };
  
      // Apply search filter if present
      if (search && searchField) {
        if (fieldTypes.stringFields.includes(searchField)) {
          options.where[searchField] = { [Op.iLike]: `%${search}%` };
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
            // Search across both fields
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
      // ✅ Extract id from request params
      const { id } = req.params;
      const updateData = req.body;
  
      // ✅ Ensure the user is authenticated and retrieve their emp_id
      const { emp_id } = req.user || {};
  
      if (!emp_id) {
        return res.status(401).json({
          error: 'Unauthorized: Missing user information.',
        });
      }
  
      console.log("Logged-in User (emp_id):", emp_id);
  
      // ✅ Find the student registration by primary key id
      const student = await StudentRegistration.findByPk(id);
  
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
  
  
  // Ensure your route uses studentId
}

module.exports = StudentRegistrationController;

