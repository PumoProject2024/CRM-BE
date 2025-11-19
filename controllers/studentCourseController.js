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
        attributes: ['studentId', 'resumePath', 'educationCourse', 'dob', 'ParentNo', 'address'],
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

      if (role === 'Super-Admin' || role === 'Placement officer') {
        authorized = true;
      }
      else if (role === 'Branch-head') {
        if (Array.isArray(userBranch) && userBranch.includes(record.branch)) {
          authorized = true;
        } else if (record.branch === userBranch) {
          authorized = true;
        }
      }
      else if (role === 'Trainer') {
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

      // Exclude placed/completed
      const excludedStatuses = ['Course Completed, Certified, and Successfully Placed'];
      if (excludedStatuses.includes(record.ProgressStatus)) {
        return res.status(403).json({
          success: false,
          message: 'This student record belongs to placed/completed category',
        });
      }

      // ⭐ Fetch from StudentRegistration
      const registration = await StudentRegistration.findOne({
        where: { studentId: record.studentId },
        attributes: [
          'studentId',
          'name',
          'email_Id',
          'contactNo',
          'ParentNo',
          'address',
          'dob',
          'educationCourse',
          'resumePath'
        ]
      });

      return res.json({
        success: true,
        message: 'Student course record fetched successfully',
        data: {
          courseDetails: record,
          studentRegistration: registration || null
        }
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
        'diplomaPassout', 'ugPassout', 'pgPassout', 'joiningDate', 'placementDate', 'expStartDate1', 'expEndDate1',
        'expStartDate2', 'expEndDate2',
        'expStartDate3', 'expEndDate3'
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
        departments,
        skillsKnown,
        branches,
        companyLocations,
        experiences,
        resumeStatus,
        courseTypes,
        courseNames,
        courseType,
        courseName,
        batch,
        learningMode,
        branch,
        searchField,
        searchValue,
        page = 1,
        limit = 10,
        sortBy = "branch",
        sortOrder = "ASC"
      } = req.query;

      const whereClause = {
        readyForPlacement: "Yes",
        placementStatus: { [Op.ne]: "Placed" }  // 👈 NEW CONDITION
      };

      // Department filter
      if (departments) {
        const departmentArray = departments.split(",").map(dept => dept.trim());
        whereClause.Department = { [Op.in]: departmentArray };
      }

      // Skills filter (REGEXP)
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

        if (whereClause[Op.and]) whereClause[Op.and].push(...skillConditions);
        else whereClause[Op.and] = skillConditions;
      }

      // Legacy: course filters
      if (req.query.courses) {
        whereClause.courseName = {
          [Op.in]: req.query.courses.split(",").map(x => x.trim())
        };
      }

      if (!req.query.courses) {
        if (courseTypes) {
          whereClause.courseType = { [Op.in]: courseTypes.split(",").map(x => x.trim()) };
        } else if (courseType) whereClause.courseType = courseType;

        if (courseNames) {
          whereClause.courseName = { [Op.in]: courseNames.split(",").map(x => x.trim()) };
        } else if (courseName) whereClause.courseName = courseName;
      }

      // Branch filter
      if (branches) {
        whereClause.branch = { [Op.in]: branches.split(",").map(x => x.trim()) };
      } else if (branch) {
        whereClause.branch = branch;
      }

      // Desired location filter
      if (companyLocations) {
        const arr = companyLocations.split(",").map(v => v.trim());
        const locConditions = [
          { desiredlocation: { [Op.iLike]: "%No Constraint%" } },
          ...arr.map(loc => ({ desiredlocation: { [Op.iLike]: `%${loc}%` } }))
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

      // Experience
      if (experiences) {
        whereClause.experience = { [Op.in]: experiences.split(",").map(x => x.trim()) };
      }

      // Single filters
      if (batch) whereClause.batch = batch;
      if (learningMode) whereClause.learningMode = learningMode;

      // Search
      if (searchField && searchValue) {
        whereClause[searchField] = { [Op.iLike]: `%${searchValue}%` };
      }

      // Pagination
      const pageNumber = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 10;
      const offset = (pageNumber - 1) * pageSize;

      // Allowed sort fields
      const allowedSortFields = [
        "id", "courseType", "courseName", "batch",
        "learningMode", "createdAt", "updatedAt", "branch"
      ];

      const sortField = allowedSortFields.includes(sortBy) ? sortBy : "branch";
      const sortDirection = ["ASC", "DESC"].includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "ASC";

      // ====== FETCH FROM DB (no sorting here) ======
      const studentCourseResults = await StudentCourse.findAll({
        where: whereClause,
        order: sortBy === "branch" ? [] : [[sortField, sortDirection]]
      });

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

      // ⭐ ADD ORIGINAL INDEX FOR STABLE SORT
      studentCourseResults.forEach((item, index) => {
        item.originalIndex = index;
      });

      // ⭐ STABLE SORT LOGIC
      const customSort = (a, b) => {
        const branchCompare = (a.branch || "").localeCompare(b.branch || "");
        if (branchCompare !== 0) return branchCompare;

        const aCompleted = a.ProgressStatus === "Course Completed";
        const bCompleted = b.ProgressStatus === "Course Completed";

        if (aCompleted && !bCompleted) return -1;
        if (!aCompleted && bCompleted) return 1;

        const statusCompare = (a.ProgressStatus || "").localeCompare(b.ProgressStatus || "");
        if (statusCompare !== 0) return statusCompare;

        return a.originalIndex - b.originalIndex; // ⭐ stable fallback
      };

      // Apply stable sorting
      if (sortBy === "branch") {
        studentCourseResults.sort(customSort);
      }

      // Registration filtering
      const studentIds = studentCourseResults.map(r => r.studentId);

      const registrationWhereClause = {
        studentId: { [Op.in]: studentIds },
        [Op.and]: [
          { pendingFees: { [Op.or]: [null, 0] } },
          { pendingFees2: { [Op.or]: [null, 0] } },
          { pendingFees3: { [Op.or]: [null, 0] } },
          { pendingFees4: { [Op.or]: [null, 0] } }
        ]
      };

      if (resumeStatus === "uploaded") {
        registrationWhereClause.resumePath = { [Op.ne]: null };
      } else if (resumeStatus === "not_uploaded") {
        registrationWhereClause[Op.or] = [
          { resumePath: { [Op.is]: null } },
          { resumePath: "" }
        ];
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

      const filteredStudentCourseResults = studentCourseResults.filter(r =>
        eligibleStudentIds.has(r.studentId)
      );

      // ⭐ reapply stable sorting
      if (sortBy === "branch") {
        filteredStudentCourseResults.sort(customSort);
      }

      const totalRecords = filteredStudentCourseResults.length;
      const paginatedResults = filteredStudentCourseResults.slice(offset, offset + pageSize);

      const regMap = registrationData.reduce((acc, r) => {
        acc[r.studentId] = r.toJSON();
        return acc;
      }, {});

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

      // Department filter
      if (departments) {
        const departmentArray = departments.split(",").map(dept => dept.trim());
        whereClause.Department = { [Op.in]: departmentArray };
      }

      // ================================================
      // 🔥 UPDATED: Skills filter (same as main controller)
      // ================================================
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
      if (courses) {
        whereClause.courseName = { [Op.in]: courses.split(",").map(c => c.trim()) };
      }

      if (!courses) {
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

      // ================================================
      // 🔥 UPDATED: Company location filter (same as main controller)
      // ================================================
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

      console.log("Excel whereClause:", whereClause);

      // ============================================
      // Fetch StudentCourse data without DB ordering
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
      // Custom sort function
      // ============================================
      const customExcelSort = (a, b) => {
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

      // Apply initial sort
      studentCourseResults.sort(customExcelSort);

      // Map studentIds
      const studentIds = studentCourseResults.map(s => s.studentId);

      // ================================================
      // 🔥 UPDATED: Registration filter (same as main controller)
      // ================================================
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
          "pendingFees4",
        ]
      });

      const eligibleStudentIds = new Set(registrationData.map(r => r.studentId));

      // Filter StudentCourse results
      let filteredStudentCourseResults = studentCourseResults.filter(s =>
        eligibleStudentIds.has(s.studentId)
      );

      // ============================================
      // Re-apply custom sort after filtering
      // ============================================
      filteredStudentCourseResults.sort(customExcelSort);

      // Map registration data
      const regMap = {};
      registrationData.forEach(r => (regMap[r.studentId] = r.toJSON()));

      // ============================================
      // Final export columns
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
      const rows = filteredStudentCourseResults.map(row => ({
        ...row.toJSON(),
        ...regMap[row.studentId]
      }));

      // Create Excel workbook
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

      // Add borders to all cells
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

      // Set response headers
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
  },

  getPlacedStudents: async (req, res) => {
    try {
      const {
        departments,
        branches,
        courseTypes,
        courseNames,
        courseType,
        courseName,
        placedBy,
        companyName,
        placementDateFrom,
        placementDateTo,
        packageRange,
        searchField,
        searchValue,
        page = 1,
        limit = 10,
        sortBy = "branch",
        sortOrder = "ASC"
      } = req.query;

      const whereClause = {
        readyForPlacement: "Yes",
        placementStatus: "Placed"
      };

      // Department filter
      if (departments) {
        whereClause.Department = {
          [Op.in]: departments.split(",").map(v => v.trim())
        };
      }

      // 📌 New Filters
      // 📌 New Filters (Improved)
      if (placedBy) {
        whereClause.placedBy = { [Op.iLike]: `%${placedBy}%` };
      }

      if (companyName) {
        whereClause.companyName = { [Op.iLike]: `%${companyName}%` };
      }

      if (packageRange) {
        switch (packageRange) {
          case "<2":
            whereClause.package = { [Op.lt]: 200000 };
            break;
          case "2-4":
            whereClause.package = { [Op.between]: [200000, 400000] };
            break;
          case "4-6":
            whereClause.package = { [Op.between]: [400000, 600000] };
            break;
          case ">6":
            whereClause.package = { [Op.gt]: 600000 };
            break;
          default:
            break;
        }
      }

      // 📅 Validate date format before filtering
      const isValidDate = (date) => !isNaN(new Date(date).getTime());

      if (placementDateFrom && placementDateTo && isValidDate(placementDateFrom) && isValidDate(placementDateTo)) {
        whereClause.placementDate = {
          [Op.between]: [placementDateFrom, placementDateTo]
        };
      } else if (placementDateFrom && isValidDate(placementDateFrom)) {
        whereClause.placementDate = {
          [Op.gte]: placementDateFrom
        };
      } else if (placementDateTo && isValidDate(placementDateTo)) {
        whereClause.placementDate = {
          [Op.lte]: placementDateTo
        };
      }

      // 🧪 Debug log → You can see what date filter your backend applied
      console.log("Applied Date Filter ->", whereClause.placementDate);

      // Course filters
      if (req.query.courses) {
        whereClause.courseName = {
          [Op.in]: req.query.courses.split(",").map(v => v.trim())
        };
      }

      if (courseTypes) {
        whereClause.courseType = {
          [Op.in]: courseTypes.split(",").map(v => v.trim())
        };
      } else if (courseType) whereClause.courseType = courseType;

      if (courseNames) {
        whereClause.courseName = {
          [Op.in]: courseNames.split(",").map(v => v.trim())
        };
      } else if (courseName) whereClause.courseName = courseName;

      // Branch Filter
      if (branches) {
        whereClause.branch = {
          [Op.in]: branches.split(",").map(v => v.trim())
        };
      } else if (req.query.branch) whereClause.branch = req.query.branch;

      // Search support
      if (searchField && searchValue) {
        whereClause[searchField] = { [Op.iLike]: `%${searchValue}%` };
      }

      const pageNumber = parseInt(page);
      const pageSize = parseInt(limit);
      const offset = (pageNumber - 1) * pageSize;

      const allowedSortFields = [
        "id", "courseType", "courseName", "branch",
        "placedBy", "companyName", "placementDate",
        "package", "createdAt", "updatedAt"
      ];

      const sortField = allowedSortFields.includes(sortBy)
        ? sortBy
        : "branch";
      const sortDirection = ["ASC", "DESC"].includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "ASC";

      const studentCourseResults = await StudentCourse.findAll({
        where: whereClause,
        order: sortBy === "branch" ? [] : [[sortField, sortDirection]]
      });

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

      // Stable sorting
      studentCourseResults.forEach((item, index) => {
        item.originalIndex = index;
      });

      const customSort = (a, b) => {
        const branchCompare = (a.branch || "").localeCompare(b.branch || "");
        if (branchCompare !== 0) return branchCompare;

        const aCompleted = a.ProgressStatus === "Course Completed";
        const bCompleted = b.ProgressStatus === "Course Completed";

        if (aCompleted && !bCompleted) return -1;
        if (!aCompleted && bCompleted) return 1;

        return a.originalIndex - b.originalIndex;
      };

      if (sortBy === "branch") {
        studentCourseResults.sort(customSort);
      }

      const studentIds = studentCourseResults.map(r => r.studentId);

      const registrationData = await StudentRegistration.findAll({
        where: { studentId: { [Op.in]: studentIds } },
        attributes: [
          "studentId",
          "resumePath",
          "pendingFees",
          "pendingFees2",
          "pendingFees3",
          "pendingFees4"
        ]
      });

      const regMap = registrationData.reduce((acc, r) => {
        acc[r.studentId] = r.toJSON();
        return acc;
      }, {});

      const enrichedRows = studentCourseResults
        .slice(offset, offset + pageSize)
        .map(row => ({
          ...row.toJSON(),
          studentRegistration: regMap[row.studentId] || null
        }));

      return res.json({
        success: true,
        data: enrichedRows,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(studentCourseResults.length / pageSize),
          totalRecords: studentCourseResults.length,
          recordsOnCurrentPage: enrichedRows.length,
          recordsPerPage: pageSize,
          hasNextPage: pageNumber < Math.ceil(studentCourseResults.length / pageSize),
          hasPrevPage: pageNumber > 1
        }
      });

    } catch (error) {
      console.error("Error in getPlacedStudents:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch placed students",
        error: error.message
      });
    }
  },

  getPlacedStudentsExcel: async (req, res) => {
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
      const whereClause = { placementStatus: "Placed" };

      // Department filter
      if (departments) {
        const departmentArray = departments.split(",").map(dept => dept.trim());
        whereClause.Department = { [Op.in]: departmentArray };
      }

      // ================================================
      // 🔥 UPDATED: Skills filter (same as main controller)
      // ================================================
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
      if (courses) {
        whereClause.courseName = { [Op.in]: courses.split(",").map(c => c.trim()) };
      }

      if (!courses) {
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

      // ================================================
      // 🔥 UPDATED: Company location filter (same as main controller)
      // ================================================
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

      console.log("Excel whereClause:", whereClause);

      // ============================================
      // Fetch StudentCourse data without DB ordering
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
      // Custom sort function
      // ============================================
      const customExcelSort = (a, b) => {
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

      // Apply initial sort
      studentCourseResults.sort(customExcelSort);

      // Map studentIds
      const studentIds = studentCourseResults.map(s => s.studentId);

      // ================================================
      // 🔥 UPDATED: Registration filter (same as main controller)
      // ================================================
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
          "pendingFees4",
        ]
      });

      const eligibleStudentIds = new Set(registrationData.map(r => r.studentId));

      // Filter StudentCourse results
      let filteredStudentCourseResults = studentCourseResults.filter(s =>
        eligibleStudentIds.has(s.studentId)
      );

      // ============================================
      // Re-apply custom sort after filtering
      // ============================================
      filteredStudentCourseResults.sort(customExcelSort);

      // Map registration data
      const regMap = {};
      registrationData.forEach(r => (regMap[r.studentId] = r.toJSON()));

      // ============================================
      // Final export columns
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
        "companyName",
        "companyLocation",
        "joiningDate",
        "jobRole",
        "placedBy",
        "package",
        "placementDate",
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
        experience: "Working Experience"
      };

      const prettifyHeader = key =>
        key
          .replace(/([A-Z])/g, " $1")
          .replace(/_/g, " ")
          .replace(/\b\w/g, l => l.toUpperCase())
          .trim();

      // Join course & registration data
      const rows = filteredStudentCourseResults.map(row => ({
        ...row.toJSON(),
        ...regMap[row.studentId]
      }));

      // Create Excel workbook
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

      // Add borders to all cells
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

      // Set response headers
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
  },


};
module.exports = studentCourseController;