const StudentCourse = require('../models/StudentCourse');
const { Op } = require('sequelize');

const studentCourseController = {
  // CREATE - Add new student course record
  create: async (req, res) => {
    try {
      const studentCourse = await StudentCourse.create(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Student course record created successfully',
        data: studentCourse
      });
    } catch (error) {
      // Handle Sequelize validation errors
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => ({
          field: err.path,
          message: err.message
        }));
        
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationErrors
        });
      }
      
      // Handle other errors
      res.status(500).json({
        success: false,
        message: 'Failed to create student course record',
        error: error.message
      });
    }
  },

  // READ - Get all student course records with pagination and filtering
  getAll: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        courseType,
        courseName,
        batch,
        learningMode,
        progressStatus,
        search
      } = req.query;

      const offset = (page - 1) * limit;
      const whereClause = {};

      // Add filters
      if (courseType) whereClause.courseType = courseType;
      if (courseName) whereClause.courseName = courseName;
      if (batch) whereClause.batch = batch;
      if (learningMode) whereClause.learningMode = learningMode;
      if (progressStatus) whereClause.ProgressStatus = progressStatus;

      // Add search functionality
      if (search) {
        whereClause[Op.or] = [
          { studentName: { [Op.iLike]: `%${search}%` } },
          { studentId: { [Op.iLike]: `%${search}%` } },
          { staffName1: { [Op.iLike]: `%${search}%` } },
          { courseName: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows } = await StudentCourse.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalRecords: count,
          recordsPerPage: parseInt(limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch student course records',
        error: error.message
      });
    }
  },
    // UPDATE - Update student course record
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      // Add modified_by field if not present
      if (req.user && req.user.id) {
        updateData.modified_by = req.user.id;
      }

      const [updatedRowsCount] = await StudentCourse.update(updateData, {
        where: { id },
        returning: true
      });

      if (updatedRowsCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Student course record not found'
        });
      }

      // Fetch updated record
      const updatedRecord = await StudentCourse.findByPk(id);

      res.json({
        success: true,
        message: 'Student course record updated successfully',
        data: updatedRecord
      });
    } catch (error) {
      // Handle Sequelize validation errors
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => ({
          field: err.path,
          message: err.message
        }));
        
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationErrors
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update student course record',
        error: error.message
      });
    }
  }
  };
module.exports = studentCourseController;
