const { Op } = require('sequelize');
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
      branch, studentStatus, educationLevel, 
      batch, learningMode, page = 1, limit = 10 
    } = req.query;
    
    const offset = (page - 1) * limit;
    const where = {};
    
    if (branch) where.branch = branch;
    if (studentStatus) where.studentStatus = studentStatus;
    if (educationLevel) where.educationLevel = educationLevel;
    if (batch) where.batch = batch;
    if (learningMode) where.learningMode = learningMode;

    const students = await Student.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: offset,
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: students.rows,
      pagination: {
        totalItems: students.count,
        totalPages: Math.ceil(students.count / limit),
        currentPage: parseInt(page)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message
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