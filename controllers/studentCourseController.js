const StudentCourse = require('../models/StudentCourse');
const StudentRegistration = require('../models/studenReg');
const ExcelJS = require('exceljs');
const { sendStudentCredentials } = require("../utils/sendStudentCredentials");
const { Sequelize, Op } = require('sequelize');

const studentCourseController = {
  // CREATE - Add new student course record
  create: async (req, res) => {
    try {
      const studentCourse = await StudentCourse.create(req.body);

      // Extract email & studentId from created record
      const { email_Id, studentId } = studentCourse;

      // Send email only if both fields exist
      if (email_Id && studentId) {
        await sendStudentCredentials(email_Id, studentId);
      } else {
        console.warn("⚠️ Skipped sending student credentials: Missing email or studentId");
      }

      res.status(201).json({
        success: true,
        message: "Student course record created successfully",
        data: studentCourse,
      });
    } catch (error) {
      // Handle Sequelize validation errors
      if (error.name === "SequelizeValidationError") {
        const validationErrors = error.errors.map((err) => ({
          field: err.path,
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: validationErrors,
        });
      }

      // Handle other errors
      res.status(500).json({
        success: false,
        message: "Failed to create student course record",
        error: error.message,
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
        page = 1,
        limit = 10,
        sortBy = 'id',
        sortOrder = 'DESC'
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
        if (req.query.branch) whereClause.branch = req.query.branch;
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
          { [Op.and]: [{ staffName1: emp_name }, { staffId1: empIdStr }] },
          { [Op.and]: [{ staffName2: emp_name }, { staffId2: empIdStr }] },
          { [Op.and]: [{ staffName3: emp_name }, { staffId3: empIdStr }] }

        ];
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Insufficient permissions'
        });
      }

      // Exclude placed/completed students
      whereClause.ProgressStatus = {
        [Op.notIn]: ['Course Completed, Certified, and Successfully Placed']
      };

      // Apply filters
      if (courseType) whereClause.courseType = courseType;
      if (courseName) whereClause.courseName = courseName;
      if (batch) whereClause.batch = batch;
      if (learningMode) whereClause.learningMode = learningMode;

      // Progress status (if explicitly filtered)
      if (progressStatus) {
        const excludedStatuses = ['Course Completed, Certified, and Successfully Placed'];
        if (!excludedStatuses.includes(progressStatus)) {
          whereClause.ProgressStatus = progressStatus;
        } else {
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
            },
            message: 'Requested progress status is handled by placed students controller'
          });
        }
      }

      // Search by field
      if (searchField && searchValue) {
        whereClause[searchField] = {
          [Op.iLike]: `%${searchValue}%`,
        };
      }

      console.log('Active Students Where Clause:', JSON.stringify(whereClause, null, 2));

      // Pagination setup
      const pageNumber = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 10;
      const offset = (pageNumber - 1) * pageSize;

      if (pageNumber < 1 || pageSize < 1 || pageSize > 100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid pagination parameters'
        });
      }

      // Sorting setup
      const allowedSortFields = ['id', 'courseType', 'courseName', 'batch', 'learningMode', 'ProgressStatus', 'createdAt', 'updatedAt'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'id';
      const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // Fetch paginated student courses
      const { count, rows } = await StudentCourse.findAndCountAll({
        where: whereClause,
        limit: pageSize,
        offset,
        order: [[sortField, sortDirection]],
        logging: false,
      });

      if (rows.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: {
            currentPage: pageNumber,
            totalPages: 0,
            totalRecords: 0,
            recordsPerPage: pageSize,
            recordsOnCurrentPage: 0,
            hasNextPage: false,
            hasPrevPage: false
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
      }

      // ✅ Fetch resume paths from StudentRegistration
      const studentIds = rows.map(row => row.studentId);
      const registrationData = await StudentRegistration.findAll({
        where: { studentId: { [Op.in]: studentIds } },
        attributes: ['studentId', 'resumePath', 'educationCourse'],
      });

      // Map resume data for easy lookup
      const registrationMap = registrationData.reduce((map, reg) => {
        map[reg.studentId] = reg.toJSON();
        return map;
      }, {});

      // Merge resumePath into each student course row
      const enrichedRows = rows.map(row => ({
        ...row.toJSON(),
        studentRegistration: registrationMap[row.studentId] || null
      }));

      // Pagination metadata
      const totalRecords = count;
      const totalPages = Math.ceil(totalRecords / pageSize);
      const hasNextPage = pageNumber < totalPages;
      const hasPrevPage = pageNumber > 1;

      return res.json({
        success: true,
        data: enrichedRows,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalRecords,
          recordsPerPage: pageSize,
          recordsOnCurrentPage: enrichedRows.length,
          hasNextPage,
          hasPrevPage,
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

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      if (!user || !user.emp_name) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Invalid user information',
        });
      }

      const { emp_name, emp_id, branch: userBranch, role } = user;
      const empIdStr = String(emp_id);

      // Find student course record
      const record = await StudentCourse.findByPk(id);

      if (!record) {
        return res.status(404).json({
          success: false,
          message: 'Student course record not found',
        });
      }

      // Role-based access check
      let authorized = false;

      if (role === 'Super-Admin') {
        authorized = true; // full access
      }
      else if (role === 'Placement officer') {
        authorized = true; // full access
      }
      else if (role === 'Branch-head') {
        // Check if record branch matches user's branch access
        if (Array.isArray(userBranch) && userBranch.includes(record.branch)) {
          authorized = true;
        } else if (record.branch === userBranch) {
          authorized = true;
        }
      }
      else if (role === 'Trainer') {
        // Trainer can access only their assigned students
        if (
          (record.staffId1 === empIdStr && record.staffName1 === emp_name) ||
          (record.staffId2 === empIdStr && record.staffName2 === emp_name) ||
          (record.staffId3 === empIdStr && record.staffName3 === emp_name) ||
          (record.mentorid === empIdStr && record.mentor === emp_name)
        ) {
          authorized = true;
        }
      }

      if (!authorized) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view this student record',
        });
      }

      // Exclude placed/completed students (same as getAll)
      const excludedStatuses = ['Course Completed, Certified, and Successfully Placed'];
      if (excludedStatuses.includes(record.ProgressStatus)) {
        return res.status(403).json({
          success: false,
          message: 'This student record belongs to placed/completed category',
        });
      }

      // Send response
      res.json({
        success: true,
        message: 'Student course record fetched successfully',
        data: record,
      });

    } catch (error) {
      console.error('Error in getById student course record:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch student course record',
        error: error.message,
      });
    }
  },

  getAllByMentor: async (req, res) => {
    try {
      const user = req.user;

      if (!user || !user.emp_name || !user.emp_id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Invalid user information',
        });
      }

      const { emp_name, emp_id } = user;
      const empIdStr = String(emp_id);
      const {
        page = 1,
        limit = 10,
        sortBy = 'id',
        sortOrder = 'DESC'
      } = req.query;

      const pageNumber = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 10;
      const offset = (pageNumber - 1) * pageSize;

      if (pageNumber < 1 || pageSize < 1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid pagination parameters'
        });
      }

      const allowedSortFields = [
        'id', 'courseType', 'courseName', 'batch',
        'learningMode', 'ProgressStatus', 'createdAt'
      ];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'id';
      const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : 'DESC';

      // Filter: mentor name AND mentor id
      const whereClause = {
        mentor: emp_name,
        mentorid: empIdStr
      };

      console.log('Mentor Filter Where Clause:', JSON.stringify(whereClause, null, 2));

      // 🔹 Fetch paginated student courses
      const { count, rows } = await StudentCourse.findAndCountAll({
        where: whereClause,
        limit: pageSize,
        offset,
        order: [[sortField, sortDirection]],
        logging: false,
      });

      if (rows.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: {
            currentPage: pageNumber,
            totalPages: 0,
            totalRecords: 0,
            recordsPerPage: pageSize,
            recordsOnCurrentPage: 0,
            hasNextPage: false,
            hasPrevPage: false
          }
        });
      }

      // ✅ Fetch StudentRegistration data (resumePath, educationCourse)
      const studentIds = rows.map(row => row.studentId);
      const registrationData = await StudentRegistration.findAll({
        where: { studentId: { [Op.in]: studentIds } },
        attributes: ['studentId', 'resumePath', 'educationCourse'],
        logging: false
      });

      // Map for quick lookup
      const registrationMap = registrationData.reduce((map, reg) => {
        map[reg.studentId] = reg.toJSON();
        return map;
      }, {});

      // Merge registration info into student courses
      const enrichedRows = rows.map(row => ({
        ...row.toJSON(),
        studentRegistration: registrationMap[row.studentId] || null
      }));

      // Pagination metadata
      const totalRecords = count;
      const totalPages = Math.ceil(totalRecords / pageSize);

      return res.json({
        success: true,
        data: enrichedRows,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalRecords,
          recordsPerPage: pageSize,
          recordsOnCurrentPage: enrichedRows.length,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1,
          nextPage: pageNumber < totalPages ? pageNumber + 1 : null,
          prevPage: pageNumber > 1 ? pageNumber - 1 : null
        }
      });

    } catch (error) {
      console.error('Error in getAllByMentor:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch mentor student data',
        error: error.message
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
    console.log('=== STAFF UPDATE REQUEST START ===');
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    console.log('User from token:', {
      emp_id: req.user?.emp_id,
      emp_name: req.user?.emp_name,
      role: req.user?.role
    });

    try {
      const { id } = req.params;
      const updateData = { ...req.body };
      const updatedBy = 'staff'; // Since this route uses authMiddleware

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No data provided for update"
        });
      }

      const existingRecord = await StudentCourse.findByPk(id);
      if (!existingRecord) {
        return res.status(404).json({
          success: false,
          message: "Student course record not found"
        });
      }

      console.log('Existing record details:', {
        studentId: existingRecord.studentId,
        mentorid: existingRecord.mentorid,
        mentor: existingRecord.mentor,
        currentKnownSkills: existingRecord.knownSkill
      });

      // === Mentor update check ===
      const mentorFields = ["mentor", "mentorid", "mentorNumber"];
      const tryingToUpdateMentor = mentorFields.some(
        field => field in updateData && updateData[field] !== existingRecord[field]
      );

      if (tryingToUpdateMentor) {
        if (existingRecord.mentorid && req.user.emp_id.toString() !== existingRecord.mentorid.toString()) {
          console.log('Mentor authorization failed:', {
            existingMentorId: existingRecord.mentorid,
            currentUserEmpId: req.user.emp_id,
            match: req.user.emp_id.toString() === existingRecord.mentorid.toString()
          });

          return res.status(403).json({
            success: false,
            message: "You are not authorized to update mentor details"
          });
        }
        console.log('Mentor authorization passed - proceeding with mentor update');
      }

      // === Skill update check ===
      const skillFields = ["knownSkill", "skillSet"];
      const tryingToUpdateSkills = skillFields.some(field => field in updateData);
      let skillsChanged = false;

      if (tryingToUpdateSkills && updateData.knownSkill !== undefined) {
        const newKnownSkills = Array.isArray(updateData.knownSkill)
          ? updateData.knownSkill.join(",")
          : (updateData.knownSkill || "");

        // Always allow staff to update knownSkill
        updateData.knownSkill = newKnownSkills;
        updateData.lastSkillUpdateBy = updatedBy;
        updateData.skillUpdateTimestamp = new Date();
        updateData.stuapprove = false;   // student needs to approve
        updateData.staffapprove = true;  // staff has approved
        skillsChanged = true;

        console.log('Skills updated by staff:', {
          newKnownSkills,
          stuapprove: updateData.stuapprove,
          staffapprove: updateData.staffapprove
        });
      }

      // Ensure skillSet formatting
      if (updateData.skillSet) {
        updateData.skillSet = Array.isArray(updateData.skillSet)
          ? updateData.skillSet.join(",")
          : updateData.skillSet;
      }

      // === Date fields cleanup ===
      const dateFields = [
        'courseStartDate', 'courseEndDate',
        'tenthPassout', 'twelfthPassout',
        'diplomaPassout', 'ugPassout', 'pgPassout', 'joiningDate', 'placementDate',
      ];

      dateFields.forEach(field => {
        if (field in updateData) {
          if (updateData[field] === '' || updateData[field] === 'Invalid date' || !updateData[field]) {
            updateData[field] = null;
          }
        }
      });
      if ("package" in updateData) {
        if (updateData.package === "" || updateData.package === null || updateData.package === undefined) {
          updateData.package = null;
        } else {
          updateData.package = parseInt(updateData.package);
          if (isNaN(updateData.package)) updateData.package = null;
        }
      }


      // Track who modified
      if (req.user?.emp_id) {
        updateData.modified_by = req.user.emp_id;
      }

      console.log('Final update data:', {
        ...updateData,
        skillsChanged,
        skillApprovals: skillsChanged ? {
          stuapprove: updateData.stuapprove,
          staffapprove: updateData.staffapprove
        } : 'No skill changes'
      });

      await StudentCourse.update(updateData, {
        where: { id },
        returning: true
      });

      const updatedRecord = await StudentCourse.findByPk(id);

      console.log('Updated record details:', {
        mentorid: updatedRecord.mentorid,
        mentor: updatedRecord.mentor,
        mentorNumber: updatedRecord.mentorNumber,
        knownSkill: updatedRecord.knownSkill,
        skillSet: updatedRecord.skillSet,
        approvals: {
          stuapprove: updatedRecord.stuapprove,
          staffapprove: updatedRecord.staffapprove
        }
      });

      const message = skillsChanged
        ? "Student course record updated successfully. Skills are pending student approval."
        : "Student course record updated successfully";

      res.json({
        success: true,
        message,
        skillsChanged,
        updatedBy,
        data: updatedRecord,
        skillApprovals: skillsChanged ? {
          stuapprove: updatedRecord.stuapprove,
          staffapprove: updatedRecord.staffapprove
        } : undefined
      });

    } catch (error) {
      console.error('Staff update error:', error);
      res.status(500).json({
        success: false,
        message: "Failed to update student course record",
        error: error.message
      });
    }
  },

  getPlacementEligibleStudents: async (req, res) => {
    try {
      const {
        // Multi-select filters from frontend
        departments,
        skillsKnown,
        branches,
        companyLocations,
        experiences,
        resumeStatus,
        // Legacy course filters (keeping for backward compatibility)
        courseTypes,
        courseNames,
        courseType,
        courseName,
        // Single filters (keeping for backward compatibility)
        batch,
        learningMode,
        branch,
        // Search parameters
        searchField,
        searchValue,
        // Pagination
        page = 1,
        limit = 10,
        sortBy = "branch",
        sortOrder = "ASC"
      } = req.query;

      // Base condition: Only students who need placement
      const whereClause = {
        readyForPlacement: "Yes"
      };

      // Department filter
      if (departments) {
        const departmentArray = departments.split(",").map(dept => dept.trim());
        whereClause.Department = { [Op.in]: departmentArray };
      }

      // Skills filter
      if (skillsKnown) {
        const skillsArray = skillsKnown.split(",").map(skill => skill.trim().toLowerCase());

        const skillConditions = skillsArray.map(skill =>
          Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("knownSkill")),
            {
              [Op.regexp]: `(^|,)\\s*${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(,|$)`
            }
          )
        );

        if (whereClause[Op.and]) {
          whereClause[Op.and].push(...skillConditions);
        } else {
          whereClause[Op.and] = skillConditions;
        }
      }

      // Legacy: course filters
      if (req.query.courses) {
        const coursesArray = req.query.courses.split(",").map(c => c.trim());
        whereClause.courseName = { [Op.in]: coursesArray };
      }

      if (!req.query.courses) {
        if (courseTypes) {
          const arr = courseTypes.split(",").map(v => v.trim());
          whereClause.courseType = { [Op.in]: arr };
        } else if (courseType) {
          whereClause.courseType = courseType;
        }

        if (courseNames) {
          const arr = courseNames.split(",").map(v => v.trim());
          whereClause.courseName = { [Op.in]: arr };
        } else if (courseName) {
          whereClause.courseName = courseName;
        }
      }

      // Branch filter
      if (branches) {
        const arr = branches.split(",").map(b => b.trim());
        whereClause.branch = { [Op.in]: arr };
      } else if (branch) {
        whereClause.branch = branch;
      }

      // Company location filter
      if (companyLocations) {
        const arr = companyLocations.split(",").map(v => v.trim());
        const locConditions = [
          { desiredlocation: { [Op.iLike]: "%No Constraint%" } },
          ...arr.map(loc => ({
            desiredlocation: { [Op.iLike]: `%${loc}%` }
          }))
        ];

        if (whereClause[Op.or]) {
          whereClause[Op.and] = [
            { [Op.or]: whereClause[Op.or] },
            { [Op.or]: locConditions }
          ];
        } else if (whereClause[Op.and]) {
          whereClause[Op.and].push({ [Op.or]: locConditions });
        } else {
          whereClause[Op.or] = locConditions;
        }
      }

      // Experience filter
      if (experiences) {
        const arr = experiences.split(",").map(v => v.trim());
        whereClause.experience = { [Op.in]: arr };
      }

      // Single filters
      if (batch) whereClause.batch = batch;
      if (learningMode) whereClause.learningMode = learningMode;

      // Search
      if (searchField && searchValue) {
        whereClause[searchField] = { [Op.iLike]: `%${searchValue}%` };
      }

      // Pagination variables
      const pageNumber = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 10;
      const offset = (pageNumber - 1) * pageSize;

      // ================================================
      // 1. NEW SORTING LOGIC (Your Update)
      // ================================================
      const allowedSortFields = [
        "id",
        "courseType",
        "courseName",
        "batch",
        "learningMode",
        "createdAt",
        "updatedAt",
        "branch"
      ];

      const sortField = allowedSortFields.includes(sortBy) ? sortBy : "branch";
      const sortDirection = ["ASC", "DESC"].includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "ASC";

      // Custom sort handler
      const customSort = (a, b) => {
        // First: branch
        const branchCompare = (a.branch || "").localeCompare(b.branch || "");
        if (branchCompare !== 0) return branchCompare;

        // Second: ProgressStatus priority (Course Completed first)
        const statusA = a.ProgressStatus || "";
        const statusB = b.ProgressStatus || "";

        if (statusA === "Course Completed" && statusB !== "Course Completed") return -1;
        if (statusA !== "Course Completed" && statusB === "Course Completed") return 1;

        // Third: Alphabetical sort of status
        return statusA.localeCompare(statusB);
      };

      // First query - without DB sorting (custom sort applied later)
      const studentCourseResults = await StudentCourse.findAll({
        where: whereClause,
        order: sortBy === "branch" || !sortBy ? [] : [[sortField, sortDirection]]
      });

      // If sorting by branch or default, apply custom sorting
      if (sortBy === "branch" || !sortBy) {
        studentCourseResults.sort(customSort);
      }

      if (studentCourseResults.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: {
            currentPage: pageNumber,
            totalPages: 0,
            totalRecords: 0,
            recordsOnCurrentPage: 0,
            recordsPerPage: pageSize,
            hasNextPage: false,
            hasPrevPage: false
          }
        });
      }

      // ================================================
      // 2. REGISTRATION CHECK — pending fees + resume filter
      // ================================================
      const studentIds = studentCourseResults.map(r => r.studentId);

      const registrationWhereClause = {
        studentId: { [Op.in]: studentIds },
        [Op.and]: [
          {
            [Op.or]: [
              { pendingFees: { [Op.or]: [null, 0] } },
              { pendingFees: { [Op.is]: null } }
            ]
          },
          {
            [Op.or]: [
              { pendingFees2: { [Op.or]: [null, 0] } },
              { pendingFees2: { [Op.is]: null } }
            ]
          },
          {
            [Op.or]: [
              { pendingFees3: { [Op.or]: [null, 0] } },
              { pendingFees3: { [Op.is]: null } }
            ]
          },
          {
            [Op.or]: [
              { pendingFees4: { [Op.or]: [null, 0] } },
              { pendingFees4: { [Op.is]: null } }
            ]
          }
        ]
      };

      if (resumeStatus) {
        if (resumeStatus === "uploaded") {
          registrationWhereClause.resumePath = {
            [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }]
          };
        } else if (resumeStatus === "not_uploaded") {
          registrationWhereClause[Op.or] = [
            { resumePath: { [Op.is]: null } },
            { resumePath: "" }
          ];
        }
      }

      if (searchField === "educationCourse" && searchValue) {
        registrationWhereClause.educationCourse = { [Op.iLike]: `%${searchValue}%` };
      }

      const registrationData = await StudentRegistration.findAll({
        where: registrationWhereClause,
        attributes: [
          "studentId",
          "resumePath",
          "educationCourse",
          "pendingFees",
          "pendingFees2",
          "pendingFees3",
          "pendingFees4"
        ]
      });

      const eligibleStudentIds = new Set(registrationData.map(r => r.studentId));

      // Filter StudentCourse results
      const filteredStudentCourseResults = studentCourseResults.filter(r =>
        eligibleStudentIds.has(r.studentId)
      );

      // ================================================
      // RE-APPLY custom sort before pagination
      // ================================================
      filteredStudentCourseResults.sort(customSort);

      const totalRecords = filteredStudentCourseResults.length;
      const paginatedResults = filteredStudentCourseResults.slice(offset, offset + pageSize);

      // Map registration data
      const regMap = registrationData.reduce((acc, r) => {
        acc[r.studentId] = r.toJSON();
        return acc;
      }, {});

      // Combine both
      const enrichedRows = paginatedResults.map(row => ({
        ...row.toJSON(),
        studentRegistration: regMap[row.studentId] || null
      }));

      return res.json({
        success: true,
        data: enrichedRows,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(totalRecords / pageSize),
          totalRecords,
          recordsOnCurrentPage: enrichedRows.length,
          recordsPerPage: pageSize,
          hasNextPage: pageNumber < Math.ceil(totalRecords / pageSize),
          hasPrevPage: pageNumber > 1
        }
      });
    } catch (error) {
      console.error("Error in getPlacementEligibleStudents:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch placement eligible students",
        error: error.message
      });
    }
  },

getPlacementEligibleStudentsExcel: async (req, res) => {
  try {
    const {
      departments,
      skillsKnown,
      branches,
      companyLocations,
      experiences,
      resumeStatus,
      courses,
      courseTypes,
      courseNames,
      courseType,
      courseName,
      batch,
      learningMode,
      branch,
      searchField,
      searchValue,
    } = req.query;

    // Base condition
    const whereClause = { readyForPlacement: "Yes" };

    if (departments) {
      whereClause.Department = { [Op.in]: departments.split(",").map(x => x.trim()) };
    }

    if (skillsKnown) {
      const skillsArray = skillsKnown.split(",").map(s => s.trim());
      const skillConditions = skillsArray.map(skill => ({
        knownSkill: { [Op.iLike]: `%${skill}%` }
      }));
      whereClause[Op.or] = skillConditions;
    }

    if (courses) {
      whereClause.courseName = { [Op.in]: courses.split(",").map(x => x.trim()) };
    } else {
      if (courseTypes) {
        whereClause.courseType = { [Op.in]: courseTypes.split(",").map(x => x.trim()) };
      } else if (courseType) {
        whereClause.courseType = courseType;
      }

      if (courseNames) {
        whereClause.courseName = { [Op.in]: courseNames.split(",").map(x => x.trim()) };
      } else if (courseName) {
        whereClause.courseName = courseName;
      }
    }

    if (branches) {
      whereClause.branch = { [Op.in]: branches.split(",").map(x => x.trim()) };
    } else if (branch) {
      whereClause.branch = branch;
    }

    if (companyLocations) {
      const locValues = companyLocations.split(",").map(x => x.trim());
      whereClause[Op.or] = locValues.map(loc => ({
        desiredlocation: { [Op.iLike]: `%${loc}%` },
      }));
    }

    if (experiences) {
      whereClause.experience = { [Op.in]: experiences.split(",").map(x => x.trim()) };
    }

    if (batch) whereClause.batch = batch;
    if (learningMode) whereClause.learningMode = learningMode;

    if (searchField && searchValue) {
      whereClause[searchField] = { [Op.iLike]: `%${searchValue}%` };
    }

    console.log("Excel whereClause:", whereClause);

    // ============================================
    // 🔥 UPDATED SECTION – NO DB ORDERING HERE
    // ============================================
    const studentCourseResults = await StudentCourse.findAll({
      where: whereClause,
      order: [] // custom sorting applied below
    });

    if (!studentCourseResults.length) {
      return res.status(404).json({
        success: false,
        message: "No eligible students found"
      });
    }

    // ============================================
    // 🔥 CUSTOM SORT FOR EXCEL
    // ============================================
    const customExcelSort = (a, b) => {
      // First sort by branch
      const branchCompare = (a.branch || "").localeCompare(b.branch || "");
      if (branchCompare !== 0) return branchCompare;

      // Then sort by ProgressStatus "Course Completed" first
      const statusA = a.ProgressStatus || "";
      const statusB = b.ProgressStatus || "";

      if (statusA === "Course Completed" && statusB !== "Course Completed") return -1;
      if (statusA !== "Course Completed" && statusB === "Course Completed") return 1;

      // Alphabetically if equal
      return statusA.localeCompare(statusB);
    };

    // Apply initial sort
    studentCourseResults.sort(customExcelSort);

    // Map studentIds
    const studentIds = studentCourseResults.map(s => s.studentId);

    const registrationWhere = {
      studentId: { [Op.in]: studentIds },
      [Op.and]: [
        { pendingFees: { [Op.or]: [0, null] } },
        { pendingFees2: { [Op.or]: [0, null] } },
        { pendingFees3: { [Op.or]: [0, null] } },
        { pendingFees4: { [Op.or]: [0, null] } }
      ]
    };

    if (resumeStatus === "uploaded") {
      registrationWhere.resumePath = { [Op.ne]: null };
    } else if (resumeStatus === "not_uploaded") {
      registrationWhere.resumePath = { [Op.is]: null };
    }

    if (searchField === "educationCourse" && searchValue) {
      registrationWhere.educationCourse = { [Op.iLike]: `%${searchValue}%` };
    }

    const registrationData = await StudentRegistration.findAll({
      where: registrationWhere,
      attributes: [
        "studentId",
        "resumePath",
        "educationCourse",
        "pendingFees",
        "pendingFees2",
        "pendingFees3",
        "pendingFees4",
      ]
    });

    const eligible = new Set(registrationData.map(r => r.studentId));

    // ============================================
    // 🔥 Sort AGAIN after filtering
    // ============================================
    let filtered = studentCourseResults.filter(s => eligible.has(s.studentId));

    filtered.sort(customExcelSort);

    // Map registration
    const regMap = {};
    registrationData.forEach(r => (regMap[r.studentId] = r.toJSON()));

    // ============================================
    // 🌟 FINAL EXPORT COLUMNS
    // ============================================
    const combinedColumns = [
      "studentName",
      "branch",
      "educationQualification",
      "passedOutYear",
      "experience",
      "Department",
      "knownSkill",
      "courseName",
      "ProgressStatus",
      "desiredlocation",
      "technicalScore",
      "technologyRemarks",
      "communicationScore",
      "communicationRemarks",
      "mockInterview",
      "mockRemarks",
      "project1Score",
      "project2Score",
      "project3Score",
      "mockTest1Score",
      "mockTest2Score",
      "mockTest3Score",
      "courseStartDate",
      "courseEndDate",
      "studentContactNumber",
      "email_Id",
      "gender",
      "mentor",
      "mentorNumber",
    ];

    // Custom header names
    const customHeaderNames = {
      educationQualification: "Education Qualification",
      passedOutYear: "Passed Out Year",
      mockRemarks: "Mock Interview Remarks",
      experience: "Working Experience"
    };

    const prettifyHeader = key =>
      key
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();

    // Join course & registration data
    const rows = filtered.map(row => ({
      ...row.toJSON(),
      ...regMap[row.studentId]
    }));

    // Create Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Placement Eligible Students");

    worksheet.columns = combinedColumns.map(key => ({
      header: customHeaderNames[key] || prettifyHeader(key),
      key,
      width: 25
    }));

    rows.forEach(row => {
      const rowData = {};

      combinedColumns.forEach(col => {
        if (col === "educationQualification") {
          const diploma = row.diplomaDegree ?? "";
          const ug = row.ugDegree ?? "";
          const pg = row.pgDegree ?? "";

          rowData[col] = [diploma, ug, pg]
            .filter(v => v && v !== "N/A")
            .join(", ");
        } else if (col === "passedOutYear") {
          const dip = row.diplomaPassout ?? "";
          const ug = row.ugPassout ?? "";
          const pg = row.pgPassout ?? "";

          rowData[col] = [dip, ug, pg]
            .filter(v => v && v !== "N/A")
            .join(", ");
        } else {
          rowData[col] = row[col] && row[col] !== "N/A" ? row[col] : "";
        }
      });

      worksheet.addRow(rowData);
    });

    // Header styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    worksheet.eachRow(row => {
      row.eachCell(cell => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Placement_Eligible_${new Date().toISOString().split("T")[0]}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Excel export error:", error);
    res.status(500).json({
      success: false,
      message: "Excel export failed",
      error: error.message
    });
  }
}



};
module.exports = studentCourseController;