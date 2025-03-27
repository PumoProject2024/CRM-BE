const { Op, Sequelize } = require('sequelize');
const StudentRegistration = require('../models/studenReg');

class StudentRegistrationController {
  static async createStudentRegistration(req, res) {
    try {
      const studentData = req.body;
  
      // ✅ Ensure user is available from the authentication middleware
      const user = req.user; // Use req.user from authMiddleware
  
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
  
      // ✅ Validate required fields
      const { contactNo, course, adminbranch, studentId: rawStudentId } = studentData;
  
      if (!contactNo || !course || !adminbranch || !rawStudentId) {
        return res.status(400).json({
          message: 'Contact number, course, admin branch, and student number are required.',
        });
      }
  
      // ✅ Generate unique studentId (e.g., "Velachery-1000")
      const studentId = `${adminbranch}-${rawStudentId}`;
      studentData.studentId = studentId;
  
      // ✅ Check if the student is already registered for the same course
      const existingStudent = await StudentRegistration.findOne({
        where: { contactNo, course },
      });
  
      if (existingStudent) {
        return res.status(409).json({ message: 'This student is already registered for this course' });
      }
  
      // ✅ Ensure studentId is unique across the system
      const existingStudentId = await StudentRegistration.findOne({
        where: { studentId },
      });
  
      if (existingStudentId) {
        return res.status(409).json({ message: 'Student ID already exists. Use a different number.' });
      }
  
      // ✅ Add modified_by field with the logged-in user's emp_id
      studentData.modified_by = user.emp_id;
  
      // ✅ Create new student registration
      const newRegistration = await StudentRegistration.create(studentData);
  
      res.status(201).json({
        message: 'Student Registration Created Successfully',
        student: newRegistration,
      });
    } catch (error) {
      console.error('Error creating student registration:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        details: error.message,
      });
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
        todayPendingFees,
        ...filters
      } = req.query;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);

      const options = {
        where: {},
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
        order: [["id", "ASC"]],
      };

      // Extract allowed branches from user
      const { branch: allowedBranches } = req.user;

      if (!allowedBranches || allowedBranches.length === 0) {
        return res.status(403).json({ message: "Access denied: No branch assigned" });
      }

      // Ensure branch filtering
      options.where.adminbranch = { [Op.in]: allowedBranches };

      // Comprehensive field categorization
      const fieldTypes = {
        stringFields: [
          "name", "contactNo", "course", "batch", "adminbranch", "learningMode",
          "educationLevel", "educationCourse", "department", "studentStatus", 
          "courseType", "courseDuration", "classType", "demoGivenBy", 
          "registrationPaymentMode", "registrationReferenceNo", 
          "adminEmpName", "source", "studentRequestedLocation", 
          "studentRequestedBranch", "adminlocation", "staffAssigned"
        ],
        decimalFields: [
          "courseFees", "feesCollected", "pendingFees", "discountAmount"
        ],
        numericFields: ["id", "placementneeded"],
        dateFields: [
          "dob", "demoGivenDate", "dateOfAdmission", "pendingFeesDate"
        ]
      };

      // Flexible date parsing and searching
      const parseDateSearch = (search) => {
        // If search is a short string, create flexible search conditions
        if (search.length < 4) {
          // Handle partial year, month, or day searches
          return {
            [Op.or]: [
              // Partial year match
              Sequelize.where(
                Sequelize.fn('extract', Sequelize.literal('year from "pendingFeesDate"')), 
                parseInt(search)
              ),
              // Partial month match
              Sequelize.where(
                Sequelize.fn('extract', Sequelize.literal('month from "pendingFeesDate"')), 
                parseInt(search)
              ),
              // Partial day match
              Sequelize.where(
                Sequelize.fn('extract', Sequelize.literal('day from "pendingFeesDate"')), 
                parseInt(search)
              )
            ]
          };
        }

        // Validate full date format if possible
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(search)) {
          return Sequelize.literal(`'${search}'::date`);
        }

        // Handle partial date strings like 2024, 2024-03, etc.
        const partialDateRegex = /^(\d{4})(-\d{2})?(-\d{2})?$/;
        const match = search.match(partialDateRegex);
        
        if (match) {
          const [, year, month, day] = match;
          let dateCondition = {};

          if (year) {
            dateCondition.year = parseInt(year);
          }
          if (month) {
            dateCondition.month = parseInt(month.slice(1));
          }
          if (day) {
            dateCondition.day = parseInt(day.slice(1));
          }

          return {
            [Op.and]: Object.entries(dateCondition).map(([part, value]) => 
              Sequelize.where(
                Sequelize.fn('extract', Sequelize.literal(`${part} from "pendingFeesDate"`)), 
                value
              )
            )
          };
        }

        // If no valid date pattern found, return null
        return null;
      };

      // Process search for specific date field
      if (search && searchField === 'pendingFeesDate') {
        const dateSearchCondition = parseDateSearch(search);
        
        if (dateSearchCondition) {
          options.where.pendingFeesDate = dateSearchCondition;
        } else {
          return res.status(400).json({
            error: "Invalid Date Search",
            message: `Cannot parse date search: ${search}`
          });
        }
      }

      // Rest of the existing filtering logic remains the same...

      const { count, rows: registrations } = await StudentRegistration.findAndCountAll(options);

      res.status(200).json({
        totalRegistrations: count,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        registrations,
      });
    } catch (error) {
      console.error("Error fetching student registrations:", error);
      res.status(500).json({
        error: "Internal Server Error",
        details: error.message,
      });
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
  } // Ensure your route uses studentId
  
  
  

}

module.exports = StudentRegistrationController;

