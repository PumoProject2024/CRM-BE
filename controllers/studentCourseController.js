const StudentCourse = require('../models/StudentCourse');
const { Sequelize, Op } = require('sequelize');

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
        courseType,
        courseName,
        batch,
        learningMode,
        progressStatus,
        searchField,
        searchValue,
      } = req.query;

      const whereClause = {};
      const user = req.user;

      if (!user || !user.emp_name) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Invalid user information',
        });
      }

      const { emp_name, branch: userBranch, role } = user;

      // Role-based access control
      if (role === 'Super-Admin') {
        // Super-Admin can see all records
        if (req.query.branch) {
          whereClause.branch = req.query.branch;
        }
        // No branch restriction for Super-Admin if no branch specified
      } else if (role === 'Branch-head') {
        if (req.query.branch) {
          whereClause.branch = req.query.branch;
        } else if (Array.isArray(userBranch)) {
          whereClause.branch = { [Op.in]: userBranch };
        } else if (userBranch) {
          whereClause.branch = userBranch;
        }
      } else if (role === 'Trainer') {
        whereClause[Op.or] = [
          { staffName1: emp_name },
          { staffName2: emp_name },
          { staffName3: emp_name }
        ];
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Insufficient permissions'
        });
      }

      // Apply filters
      if (courseType) whereClause.courseType = courseType;
      if (courseName) whereClause.courseName = courseName;
      if (batch) whereClause.batch = batch;
      if (learningMode) whereClause.learningMode = learningMode;
      if (progressStatus) whereClause.ProgressStatus = progressStatus;

      // Apply search on specific field
      if (searchField && searchValue) {
        whereClause[searchField] = {
          [Op.iLike]: `%${searchValue}%`,
        };
      }

      console.log('Where Clause:', JSON.stringify(whereClause, null, 2));

      // Fetch ALL data without pagination
      const allRecords = await StudentCourse.findAll({
        where: whereClause,
        order: [['id', 'DESC']],
        logging: console.log, // Shows the actual SQL query
      });

      console.log('Total records returned:', allRecords.length);

      // Return all records
      res.json({
        success: true,
        data: allRecords,
        totalRecords: allRecords.length,
      });

    } catch (error) {
      console.error('Error in getAll:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch student course records',
        error: error.message,
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
