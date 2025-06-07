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
      let {
        page = 1,
        limit = 10,
        courseType,
        courseName,
        batch,
        learningMode,
        progressStatus,
        searchField,
        searchValue,
      } = req.query;

      // Convert page and limit to integers
      page = parseInt(page);
      limit = parseInt(limit);

      const offset = (page - 1) * limit;
      const whereClause = {};

      const user = req.user;

      if (!user || !user.emp_name) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Invalid user information',
        });
      }

      const { emp_name, has_access, branch: userBranch } = user;

      if (has_access === true) {
        // existing branch access logic
        if (req.query.branch) {
          whereClause.branch = req.query.branch;
        } else if (Array.isArray(userBranch)) {
          whereClause.branch = { [Op.in]: userBranch };
        } else {
          whereClause.branch = userBranch;
        }
      } else {
        // no access, restrict by staffName1, staffName2, or staffName3 matching emp_name
        whereClause[Op.or] = [
          { staffName1: emp_name },
          { staffName2: emp_name },
          { staffName3: emp_name }
        ];
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

      // Debug log for pagination (optional, remove in production)
      console.log('Pagination:', { page, limit, offset });

      // Fetch paginated data
      const { count, rows } = await StudentCourse.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [
          [Sequelize.literal(`CAST(SUBSTRING("studentId" FROM '[0-9]+$') AS INTEGER)`), 'DESC']
        ]
      });

      // Return paginated response
      res.json({
        success: true,
        data: rows,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          totalRecords: count,
          recordsPerPage: limit,
        },
      });
    } catch (error) {
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
