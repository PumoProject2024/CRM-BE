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
        page = 1,           // Default to page 1
        limit = 10,         // Default to 10 records per page
        sortBy = 'id',      // Default sort field
        sortOrder = 'DESC'  // Default sort order
      } = req.query;

      const whereClause = {};
      const user = req.user;

      if (!user || !user.emp_name) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Invalid user information',
        });
      }

      const { emp_name, emp_id, branch: userBranch, role } = user;
      const empIdStr = String(emp_id);

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
          {
            [Op.and]: [
              { staffName1: emp_name },
              { staffId1: empIdStr }
            ]
          },
          {
            [Op.and]: [
              { staffName2: emp_name },
              { staffId2: empIdStr }
            ]
          },
          {
            [Op.and]: [
              { staffName3: emp_name },
              { staffId3: empIdStr }
            ]
          }
        ];
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Insufficient permissions'
        });
      }

      // EXCLUDE placed/completed students from original controller
      whereClause.ProgressStatus = {
        [Op.notIn]: ['Course Completed, Certified, and Successfully Placed']
      };

      // Apply filters
      if (courseType) whereClause.courseType = courseType;
      if (courseName) whereClause.courseName = courseName;
      if (batch) whereClause.batch = batch;
      if (learningMode) whereClause.learningMode = learningMode;
      
      // If progressStatus filter is provided, combine it with the exclusion
      if (progressStatus) {
        // Make sure the requested status is not in the excluded list
        const excludedStatuses = ['Course Completed, Certified, and Successfully Placed'];
        if (!excludedStatuses.includes(progressStatus)) {
          whereClause.ProgressStatus = progressStatus;
        } else {
          // If user tries to filter for excluded status, return empty result
          return res.json({
            success: true,
            data: [],
            pagination: {
              currentPage: 1,
              totalPages: 0,
              totalRecords: 0,
              recordsPerPage: parseInt(limit) || 10,
              recordsOnCurrentPage: 0,
              hasNextPage: false,
              hasPrevPage: false,
              nextPage: null,
              prevPage: null
            },
            message: 'Requested progress status is handled by placed students controller'
          });
        }
      }

      // Apply search on specific field
      if (searchField && searchValue) {
        whereClause[searchField] = {
          [Op.iLike]: `%${searchValue}%`,
        };
      }

      console.log('Active Students Where Clause:', JSON.stringify(whereClause, null, 2));

      // Pagination calculations
      const pageNumber = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 10;
      const offset = (pageNumber - 1) * pageSize;

      // Validate pagination parameters
      if (pageNumber < 1) {
        return res.status(400).json({
          success: false,
          message: 'Page number must be greater than 0'
        });
      }

      if (pageSize < 1 || pageSize > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
      }

      // Validate sort parameters
      const allowedSortFields = ['id', 'courseType', 'courseName', 'batch', 'learningMode', 'ProgressStatus', 'createdAt', 'updatedAt'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'id';
      const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // Fetch paginated data with count
      const { count, rows } = await StudentCourse.findAndCountAll({
        where: whereClause,
        limit: pageSize,
        offset: offset,
        order: [[sortField, sortDirection]],
        logging: console.log, // Shows the actual SQL query
      });

      // Calculate pagination metadata
      const totalRecords = count;
      const totalPages = Math.ceil(totalRecords / pageSize);
      const hasNextPage = pageNumber < totalPages;
      const hasPrevPage = pageNumber > 1;

      console.log(`Active Students Pagination: Page ${pageNumber}/${totalPages}, Records: ${rows.length}/${totalRecords}`);

      // Return paginated response
      res.json({
        success: true,
        data: rows,
        pagination: {
          currentPage: pageNumber,
          totalPages: totalPages,
          totalRecords: totalRecords,
          recordsPerPage: pageSize,
          recordsOnCurrentPage: rows.length,
          hasNextPage: hasNextPage,
          hasPrevPage: hasPrevPage,
          nextPage: hasNextPage ? pageNumber + 1 : null,
          prevPage: hasPrevPage ? pageNumber - 1 : null
        },
        filters: {
          courseType,
          courseName,
          batch,
          learningMode,
          progressStatus,
          searchField,
          searchValue,
          sortBy: sortField,
          sortOrder: sortDirection
        }
      });

    } catch (error) {
      console.error('Error in getAll active students:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active student course records',
        error: error.message,
      });
    }
  },
  placed: async (req, res) => {
    try {
      const {
        courseType,
        courseName,
        batch,
        learningMode,
        searchField,
        searchValue,
        page = 1,           // Default to page 1
        limit = 10,         // Default to 10 records per page
        sortBy = 'id',      // Default sort field
        sortOrder = 'DESC'  // Default sort order
      } = req.query;

      const whereClause = {};
      const user = req.user;

      if (!user || !user.emp_name) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Invalid user information',
        });
      }

      const { emp_name, emp_id, branch: userBranch, role } = user;
      const empIdStr = String(emp_id);

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
          {
            [Op.and]: [
              { staffName1: emp_name },
              { staffId1: empIdStr }
            ]
          },
          {
            [Op.and]: [
              { staffName2: emp_name },
              { staffId2: empIdStr }
            ]
          },
          {
            [Op.and]: [
              { staffName3: emp_name },
              { staffId3: empIdStr }
            ]
          }
        ];
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Insufficient permissions'
        });
      }

      // MAIN FILTER: Only show placed/completed students
      whereClause.ProgressStatus = {
        [Op.in]: ['Course Completed, Certified, and Successfully Placed']
      };

      // Apply additional filters
      if (courseType) whereClause.courseType = courseType;
      if (courseName) whereClause.courseName = courseName;
      if (batch) whereClause.batch = batch;
      if (learningMode) whereClause.learningMode = learningMode;

      // Apply search on specific field
      if (searchField && searchValue) {
        whereClause[searchField] = {
          [Op.iLike]: `%${searchValue}%`,
        };
      }

      console.log('Placed Students Where Clause:', JSON.stringify(whereClause, null, 2));

      // Pagination calculations
      const pageNumber = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 10;
      const offset = (pageNumber - 1) * pageSize;

      // Validate pagination parameters
      if (pageNumber < 1) {
        return res.status(400).json({
          success: false,
          message: 'Page number must be greater than 0'
        });
      }

      if (pageSize < 1 || pageSize > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
      }

      // Validate sort parameters
      const allowedSortFields = ['id', 'courseType', 'courseName', 'batch', 'learningMode', 'ProgressStatus', 'createdAt', 'updatedAt'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'id';
      const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // Fetch paginated data with count
      const { count, rows } = await StudentCourse.findAndCountAll({
        where: whereClause,
        limit: pageSize,
        offset: offset,
        order: [[sortField, sortDirection]],
        logging: console.log, // Shows the actual SQL query
      });

      // Calculate pagination metadata
      const totalRecords = count;
      const totalPages = Math.ceil(totalRecords / pageSize);
      const hasNextPage = pageNumber < totalPages;
      const hasPrevPage = pageNumber > 1;

      console.log(`Placed Students Pagination: Page ${pageNumber}/${totalPages}, Records: ${rows.length}/${totalRecords}`);

      // Return paginated response
      res.json({
        success: true,
        data: rows,
        pagination: {
          currentPage: pageNumber,
          totalPages: totalPages,
          totalRecords: totalRecords,
          recordsPerPage: pageSize,
          recordsOnCurrentPage: rows.length,
          hasNextPage: hasNextPage,
          hasPrevPage: hasPrevPage,
          nextPage: hasNextPage ? pageNumber + 1 : null,
          prevPage: hasPrevPage ? pageNumber - 1 : null
        },
        filters: {
          courseType,
          courseName,
          batch,
          learningMode,
          progressStatus: ['Course Completed', 'Certified', 'Successfully Placed'],
          searchField,
          searchValue,
          sortBy: sortField,
          sortOrder: sortDirection
        }
      });

    } catch (error) {
      console.error('Error in getAll placed students:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch placed student records',
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
  },
  getPlacementEligibleStudents: async (req, res) => {
    try {
      const {
        courseType,
        courseName,
        batch,
        learningMode,
        branch,
        searchField,
        searchValue,
        page = 1,
        limit = 10,
        sortBy = 'id',
        sortOrder = 'DESC'
      } = req.query;

      // Base condition: Only students who need placement and completed course
      const whereClause = {
        placementneeded: 'Yes',
        ProgressStatus: 'Course Completed'
      };

      // Optional filters
      if (courseType) whereClause.courseType = courseType;
      if (courseName) whereClause.courseName = courseName;
      if (batch) whereClause.batch = batch;
      if (learningMode) whereClause.learningMode = learningMode;
      if (branch) whereClause.branch = branch;

      // Optional search
      if (searchField && searchValue) {
        whereClause[searchField] = { [Op.iLike]: `%${searchValue}%` };
      }

      // Pagination
      const pageNumber = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 10;
      const offset = (pageNumber - 1) * pageSize;

      // Sorting
      const allowedSortFields = ['id', 'courseType', 'courseName', 'batch', 'learningMode', 'createdAt', 'updatedAt'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'id';
      const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // Fetch records
      const { count, rows } = await StudentCourse.findAndCountAll({
        where: whereClause,
        limit: pageSize,
        offset,
        order: [[sortField, sortDirection]]
      });

      const totalPages = Math.ceil(count / pageSize);

      return res.json({
        success: true,
        data: rows,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalRecords: count,
          recordsOnCurrentPage: rows.length,
          recordsPerPage: pageSize,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1
        },
        filters: {
          courseType,
          courseName,
          batch,
          learningMode,
          branch,
          searchField,
          searchValue,
          sortBy: sortField,
          sortOrder: sortDirection
        }
      });

    } catch (error) {
      console.error('Error in getPlacementEligibleStudents:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch placement eligible students',
        error: error.message,
      });
    }
  }
};
module.exports = studentCourseController;
