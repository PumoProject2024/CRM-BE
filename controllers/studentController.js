const { Op, fn, col, where: whereSequelize } = require("sequelize");
const { Student } = require('../models/student');

// Create a new student
exports.createStudent = async (req, res) => {
  try {
    const newStudent = await Student.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: newStudent
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to create student',
      error: error.message
    });
  }
};

// Get all students with optional filtering
exports.getAllStudents = async (req, res) => {
  try {
    const {
      branch,
      createdToday,
      followUpToday,
      search = '',
      page = 1,
      limit = 10,
      ...filters
    } = req.query;

    const offset = (page - 1) * parseInt(limit);
    const user = req.user;

    if (!user || !user.emp_name) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Invalid user information",
      });
    }

    const where = {};
    const { emp_name, has_access, branch: userBranch } = user;

    // Branch-based access control
    if (has_access === true) {
      if (branch) {
        where.branch = branch;
      } else if (Array.isArray(userBranch)) {
        where.branch = { [Op.in]: userBranch };
      } else {
        where.branch = userBranch;
      }
    } else {
      where.adminName = emp_name;
    }

    // Filter for today's created records
    if (createdToday === 'true') {
      const todayDateOnly = new Date().toISOString().split('T')[0];
      where[Op.and] = [
        ...(where[Op.and] || []),
        whereSequelize(fn('DATE', col('createdAt')), todayDateOnly),
      ];
    }

    // Filter for today's follow_up
    if (followUpToday === 'true') {
      const todayDateOnly = new Date().toISOString().split('T')[0];
      where[Op.and] = [
        ...(where[Op.and] || []),
        whereSequelize(fn('DATE', col('follow_up')), todayDateOnly),
      ];
    }

    // Global search
    if (search.trim() !== '') {
      const searchLower = search.toLowerCase();
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            { name: { [Op.iLike]: `%${searchLower}%` } },
            { email_Id: { [Op.iLike]: `%${searchLower}%` } },
            { contactNo: { [Op.iLike]: `%${searchLower}%` } },
            { department: { [Op.iLike]: `%${searchLower}%` } },
            { enrollment_status: { [Op.iLike]: `%${searchLower}%` } },
            { educationLevel: { [Op.iLike]: `%${searchLower}%` } },
            { educationCourse: { [Op.iLike]: `%${searchLower}%` } },
            { course: { [Op.iLike]: `%${searchLower}%` } },
            { studentStatus: { [Op.iLike]: `%${searchLower}%` } },
            { branch: { [Op.iLike]: `%${searchLower}%` } },
            { adminName: { [Op.iLike]: `%${searchLower}%` } },
            { studentRequirement: { [Op.iLike]: `%${searchLower}%` } },
            { admin_feedback: { [Op.iLike]: `%${searchLower}%` } },
            { classType: { [Op.iLike]: `%${searchLower}%` } },
            { batch: { [Op.iLike]: `%${searchLower}%` } },
            { learningMode: { [Op.iLike]: `%${searchLower}%` } },
            { courseType: { [Op.iLike]: `%${searchLower}%` } },
          ],
        },
      ];
    }

    // Apply other dynamic filters
    for (let filter in filters) {
      if (filters[filter]) {
        where[filter] = filters[filter];
      }
    }

   const students = await Student.findAndCountAll({
  where,
  order: [['createdAt', 'DESC']],
});


    res.status(200).json({
      success: true,
      data: students.rows,
      pagination: {
        totalItems: students.count,
        totalPages: Math.ceil(students.count / limit),
        currentPage: parseInt(page),
      },
    });
  } catch (error) {
    console.error("Error in getAllStudents:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch students",
      error: error.message,
    });
  }
};

// Get a single student by ID
exports.getStudentByContactNo = async (req, res) => {
  try {
    // Fetch the student by contactNo instead of id
    const student = await Student.findOne({
      where: { contactNo: req.params.contactNo }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student',
      error: error.message
    });
  }
};

// Update a student
exports.updateStudent = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    await student.update(req.body);

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: student
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update student',
      error: error.message
    });
  }
};

// Delete a student
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    await student.destroy();

    res.status(200).json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete student',
      error: error.message
    });
  }
};

// Search students
exports.searchStudents = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const students = await Student.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { email_Id: { [Op.iLike]: `%${query}%` } },
          { contactNo: { [Op.iLike]: `%${query}%` } }
        ]
      }
    });

    res.status(200).json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to search students',
      error: error.message
    });
  }
};