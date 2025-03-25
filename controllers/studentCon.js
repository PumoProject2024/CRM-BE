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

      const stringFields = ["name", "contactNo", "course", "batch", "adminbranch", "learningMode"];
      const exactFields = ["id"];

      Object.entries(filters).forEach(([key, value]) => {
        if (stringFields.includes(key)) {
          options.where[key] = { [Op.iLike]: `%${value}%` };
        } else if (exactFields.includes(key)) {
          const idValue = parseInt(value, 10);
          if (!isNaN(idValue)) {
            options.where.id = idValue;
          }
        }
      });

      if (todayPendingFees === "true" || dueToday === "true") {
        options.where.pendingFeesDate = { [Op.eq]: Sequelize.literal("CURRENT_DATE") };
      }

      if (search && searchField) {
        if (exactFields.includes(searchField)) {
          // Handle exact match for fields like 'id'
          const idValue = parseInt(search, 10);
          if (!isNaN(idValue)) {
            options.where[searchField] = idValue; // Exact match for id
          }
        } else if (stringFields.includes(searchField)) {
          // Handle partial match for string fields
          options.where[searchField] = { [Op.iLike]: `%${search}%` };
        }
      } else if (search) {
        // General search across multiple fields
        options.where[Op.or] = [
          ...stringFields.map((field) => ({ [field]: { [Op.iLike]: `%${search}%` } })),
          { id: !isNaN(parseInt(search, 10)) ? parseInt(search, 10) : null },
        ];
      }
      

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

