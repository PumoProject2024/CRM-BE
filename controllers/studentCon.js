const { Op, Sequelize } = require('sequelize');
const StudentRegistration = require('../models/studenReg');

class StudentRegistrationController {
  static async createStudentRegistration(req, res) {
    try {
      const studentData = req.body;
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

      // ✅ Convert empty strings to null (Fix validation errors)
      Object.keys(studentData).forEach(key => {
        if (studentData[key] === "") {
          studentData[key] = null;
        }
      });

      // ✅ Generate unique studentId
      const studentId = `${adminbranch}-${rawStudentId}`;
      studentData.studentId = studentId;

      // ✅ Check if student already registered for the same course
      const existingStudent = await StudentRegistration.findOne({
        where: { contactNo, course },
      });

      if (existingStudent) {
        return res.status(409).json({ message: 'This student is already registered for this course' });
      }

      // ✅ Ensure studentId is unique
      const existingStudentId = await StudentRegistration.findOne({
        where: { studentId },
      });

      if (existingStudentId) {
        return res.status(409).json({ message: 'Student ID already exists. Use a different number.' });
      }

      // ✅ Add modified_by field
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
        order: [["name", "ASC"]],
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
      // ✅ Apply filtering based on role
      if (role === "BDE") {
        options.where.adminEmpName = emp_name; // Show only records where adminEmpName matches the logged-in BDE
      } else if (role === "Trainer") {
        options.where.staffAssigned = emp_name; // Show only records where staffAssigned matches the logged-in Trainer
      } else {
        options.where.adminbranch = { [Op.in]: allowedBranches }; // Regular branch-based filtering
      }
      if (dueToday === "true") {
        const todayDate = new Date().toISOString().split("T")[0]; // Get YYYY-MM-DD format
        options.where[Op.or] = [
          { pendingFeesDate: { [Op.eq]: Sequelize.literal(`'${todayDate}'::date`) } },
          { pendingFeesDate2: { [Op.eq]: Sequelize.literal(`'${todayDate}'::date`) } }
        ];
      }


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
        decimalFields: ["courseFees", "feesCollected", "pendingFees", "discountAmount","pendingFees2"],
        numericFields: ["id", "placementneeded"],
        dateFields: ["dob", "demoGivenDate", "dateOfAdmission", "pendingFeesDate","pendingFeesDate2"]
      };

      // Validate searchField
      if (searchField && !Object.values(fieldTypes).flat().includes(searchField)) {
        return res.status(400).json({ error: "Invalid search field" });
      }

      // Function to handle date searching
      const parseDateSearch = (search) => {
        if (!search || search.trim() === "") return null;

        if (search.length < 4) {
          return {
            [Op.or]: [
              Sequelize.where(Sequelize.fn('extract', Sequelize.literal('year from "pendingFeesDate"')), parseInt(search)),
              Sequelize.where(Sequelize.fn('extract', Sequelize.literal('month from "pendingFeesDate"')), parseInt(search)),
              Sequelize.where(Sequelize.fn('extract', Sequelize.literal('day from "pendingFeesDate"')), parseInt(search))
            ]
          };
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(search)) {
          return { [Op.eq]: Sequelize.literal(`'${search}'::date`) };
        }

        const partialDateRegex = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/;
        const match = search.match(partialDateRegex);

        if (match) {
          const [, year, , month, , day] = match;
          let conditions = [];

          if (year) {
            conditions.push(Sequelize.where(Sequelize.fn('extract', Sequelize.literal('year from "pendingFeesDate"')), parseInt(year)));
          }
          if (month && month.length === 2) {  // Ensure valid MM
            conditions.push(Sequelize.where(Sequelize.fn('extract', Sequelize.literal('month from "pendingFeesDate"')), parseInt(month)));
          }
          if (day && day.length === 2) {  // Ensure valid DD
            conditions.push(Sequelize.where(Sequelize.fn('extract', Sequelize.literal('day from "pendingFeesDate"')), parseInt(day)));
          }

          return { [Op.and]: conditions };
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
          if (dateSearchCondition) {
            options.where[searchField] = dateSearchCondition;
          } else {
            return res.status(400).json({ error: "Invalid Date Search", message: `Cannot parse date search: ${search}` });
          }
        }
      }

      console.log("Generated Query Options:", JSON.stringify(options, null, 2));

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
  } // Ensure your route uses studentId

}

module.exports = StudentRegistrationController;

