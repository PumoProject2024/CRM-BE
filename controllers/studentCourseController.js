const StudentCourse = require('../models/StudentCourse');
const StudentRegistration = require('../models/studenReg');
const MappedStudent = require('../models/Mappedstudents');
const Placement = require('../models/Placement');
const ExcelJS = require('exceljs');
const { sendStudentCredentials } = require("../utils/sendStudentCredentials");
const { sendStudentLoginReminder } = require("../utils/sendStudentLoginReminder");
const buildStudentFilters = require("../utils/studentFilters");
const { Sequelize, Op } = require('sequelize');
const logger = require("../logger");

const studentCourseController = {
  // CREATE - Add new student course record
  create: async (req, res) => {
    try {
      const payload = { ...req.body };

      // 🔒 Placement safety logic
      if (!payload.placementStatus) {
        payload.placementStatus =
          payload.readyForPlacement === "No"
            ? "Not Ready for Placement"
            : "Awaiting for placement";
      }
      if ("readyForPlacement" in payload) {
        if (payload.readyForPlacement === "Yes") {
          payload.readyForPlacementDate = new Date();
        } else {
          payload.readyForPlacementDate = null;
        }
      }
      const studentCourse = await StudentCourse.create(payload);

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
        resumeStatus,
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

      // ================== ✅ RBAC (UNCHANGED) ==================
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

      // ================== ✅ COMMON FILTERS ==================
      Object.assign(whereClause, buildStudentFilters(req.query));

      // ================== ✅ EXCLUDE PLACED ==================
      whereClause.placementStatus = {
        [Op.notIn]: ['Placed']
      };

      // ================== ✅ PROGRESS STATUS ==================
      if (progressStatus) {
        if (progressStatus !== 'Placed') {
          whereClause.placementStatus = progressStatus;
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
            message: 'Placed students are handled by placed students controller'
          });
        }
      }

      console.log('Active Students Where Clause:', JSON.stringify(whereClause, null, 2));

      // ================== ✅ PAGINATION ==================
      const pageNumber = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 10;
      const offset = (pageNumber - 1) * pageSize;

      if (pageNumber < 1 || pageSize < 1 || pageSize > 100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid pagination parameters'
        });
      }

      // ================== ✅ SORTING ==================
      const allowedSortFields = [
        'id', 'courseType', 'courseName',
        'batch', 'learningMode', 'ProgressStatus',
        'createdAt', 'updatedAt'
      ];

      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'id';
      const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : 'DESC';

      // ================== ✅ FETCH ==================
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

      // ================== ✅ REGISTRATION FETCH ==================
      const studentIds = rows.map(row => row.studentId);

      let registrationWhereClause = {
        studentId: { [Op.in]: studentIds }
      };

      // ✅ Resume filter
      if (resumeStatus === "uploaded") {
        registrationWhereClause.resumePath = { [Op.ne]: null };
      } else if (resumeStatus === "not_uploaded") {
        registrationWhereClause[Op.and] = [
          {
            [Op.or]: [
              { resumePath: { [Op.is]: null } },
              { resumePath: "" }
            ]
          }
        ];
      }

      // ✅ Education search fix
      if (searchField === "educationCourse" && searchValue) {
        registrationWhereClause.educationCourse = {
          [Op.iLike]: `%${searchValue}%`
        };
      }

      const registrationData = await StudentRegistration.findAll({
        where: registrationWhereClause,
        attributes: [
          'studentId',
          'resumePath',
          'educationCourse',
          'dob',
          'ParentNo',
          'address'
        ],
      });

      // ================== ✅ OPTIONAL FILTER BY RESUME ==================
      let filteredRows = rows;

      if (resumeStatus) {
        const validIds = new Set(registrationData.map(r => r.studentId));
        filteredRows = rows.filter(r => validIds.has(r.studentId));
      }

      // ================== ✅ MAP DATA ==================
      const registrationMap = registrationData.reduce((map, reg) => {
        map[reg.studentId] = reg.toJSON();
        return map;
      }, {});

      const enrichedRows = filteredRows.map(row => ({
        ...row.toJSON(),
        studentRegistration: registrationMap[row.studentId] || null
      }));

      // ================== ✅ PAGINATION ==================
      const totalRecords = resumeStatus ? enrichedRows.length : count;
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
  getAllExcel: async (req, res) => {
    try {
      const {
        resumeStatus,
        progressStatus,
        searchField,
        searchValue
      } = req.query;

      const whereClause = {};
      const user = req.user;

      if (!user || !user.emp_name) {
        return res.status(403).json({
          success: false,
          message: "Access denied: Invalid user information",
        });
      }

      const { emp_name, emp_id, branch: userBranch, role } = user;
      const empIdStr = String(emp_id);

      // ================== ✅ RBAC ==================
      if (role === "Super-Admin") {
        if (req.query.branch) whereClause.branch = req.query.branch;
      } else if (role === "Branch-head") {
        if (req.query.branch) {
          whereClause.branch = req.query.branch;
        } else if (Array.isArray(userBranch)) {
          whereClause.branch = { [Op.in]: userBranch };
        } else if (userBranch) {
          whereClause.branch = userBranch;
        }
      } else if (role === "Trainer") {
        whereClause[Op.or] = [
          { [Op.and]: [{ staffName1: emp_name }, { staffId1: empIdStr }] },
          { [Op.and]: [{ staffName2: emp_name }, { staffId2: empIdStr }] },
          { [Op.and]: [{ staffName3: emp_name }, { staffId3: empIdStr }] }
        ];
      } else {
        return res.status(403).json({
          success: false,
          message: "Access denied: Insufficient permissions",
        });
      }

      // ================== ✅ COMMON FILTERS ==================
      Object.assign(whereClause, buildStudentFilters(req.query));

      // ================== ✅ EXCLUDE PLACED ==================
      whereClause.placementStatus = {
        [Op.notIn]: ["Placed"]
      };

      // ================== ✅ PROGRESS STATUS ==================
      if (progressStatus) {
        if (progressStatus !== "Placed") {
          whereClause.placementStatus = progressStatus;
        } else {
          return res.json({
            success: true,
            data: [],
            message: "Placed students are handled by placed students controller"
          });
        }
      }

      console.log("Excel whereClause:", whereClause);

      // ================== ✅ FETCH DATA ==================
      const studentCourseResults = await StudentCourse.findAll({
        where: whereClause,
        order: [] // custom sort below
      });

      if (!studentCourseResults.length) {
        return res.status(404).json({
          success: false,
          message: "No students found"
        });
      }

      // ================== ✅ CUSTOM SORT ==================
      const customSort = (a, b) => {
        const branchCompare = (a.branch || "").localeCompare(b.branch || "");
        if (branchCompare !== 0) return branchCompare;

        const aCompleted = a.ProgressStatus === "Course Completed";
        const bCompleted = b.ProgressStatus === "Course Completed";

        if (aCompleted && !bCompleted) return -1;
        if (!aCompleted && bCompleted) return 1;

        return (a.ProgressStatus || "").localeCompare(b.ProgressStatus || "");
      };

      studentCourseResults.sort(customSort);

      const studentIds = studentCourseResults.map(s => s.studentId);

      // ================== ✅ REGISTRATION FILTER ==================
      const registrationWhereClause = {
        studentId: { [Op.in]: studentIds }
      };

      // Resume filter
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

      // Education search fix
      if (searchField === "educationCourse" && searchValue) {
        registrationWhereClause.educationCourse = {
          [Op.iLike]: `%${searchValue}%`
        };
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
          "lastLogin"
        ]
      });

      const validIds = new Set(registrationData.map(r => r.studentId));

      let filteredResults = studentCourseResults;

      if (resumeStatus) {
        filteredResults = studentCourseResults.filter(s =>
          validIds.has(s.studentId)
        );
      }

      filteredResults.sort(customSort);

      // ================== ✅ MAP DATA ==================
      const regMap = {};
      registrationData.forEach(r => {
        regMap[r.studentId] = r.toJSON();
      });

      const rows = filteredResults.map(row => ({
        ...row.toJSON(),
        ...regMap[row.studentId]
      }));

      // ================== ✅ EXCEL ==================
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Students");

      const columns = [
        "studentName", "branch", "educationQualification", "passedOutYear",
        "experience", "Department", "knownSkill", "courseName",
        "ProgressStatus", "desiredlocation", "technicalScore",
        "communicationScore", "mockInterview",
        "studentContactNumber", "email_Id", "gender",
        "resumeStatus", "createdAt", "lastLogin"
      ];

      const prettifyHeader = key =>
        key.replace(/([A-Z])/g, " $1").replace(/\b\w/g, l => l.toUpperCase());

      worksheet.columns = columns.map(key => ({
        header: prettifyHeader(key),
        key,
        width: 25
      }));

      rows.forEach(row => {
        const rowData = {};

        columns.forEach(col => {
          if (col === "resumeStatus") {
            rowData[col] = row.resumePath ? "Yes" : "";
          } else if (col === "createdAt") {
            rowData[col] = row.createdAt
              ? new Date(row.createdAt).toISOString().split("T")[0]
              : "";
          } else if (col === "lastLogin") {
            rowData[col] = row.lastLogin
              ? new Date(row.lastLogin).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata"
              })
              : "";
          } else if (col === "educationQualification") {
            rowData[col] = [row.diplomaDegree, row.ugDegree, row.pgDegree]
              .filter(v => v && v !== "N/A")
              .join(", ");
          } else if (col === "passedOutYear") {
            rowData[col] = [row.diplomaPassout, row.ugPassout, row.pgPassout]
              .filter(v => v && v !== "N/A")
              .join(", ");
          } else {
            rowData[col] = row[col] && row[col] !== "N/A" ? row[col] : "";
          }
        });

        worksheet.addRow(rowData);
      });

      // Header style
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };

      // ================== ✅ RESPONSE ==================
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Students_${new Date().toISOString().split("T")[0]}.xlsx"`
      );

      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      logger.error({
        message: "Error in getAllExcel",
        error: error.message,
        stack: error.stack,
        route: req.originalUrl,
        query: req.query,
        user: req.user || null
      });

      res.status(500).json({
        success: false,
        message: "Excel export failed",
        error: error.message
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

        // 🔹 1. NORMAL ACCESS (own students)
        const isOwnStudent =
          (record.staffId1 === empIdStr && record.staffName1 === emp_name) ||
          (record.staffId2 === empIdStr && record.staffName2 === emp_name) ||
          (record.staffId3 === empIdStr && record.staffName3 === emp_name) ||
          (record.mentorid === empIdStr && record.mentor === emp_name);

        if (isOwnStudent) {
          authorized = true;
        } else {

          // 🔹 2. NEW LOGIC → Check mapping via placement
          const mapping = await MappedStudent.findOne({
            where: { studentId: record.studentId },
            include: [
              {
                model: Placement,
                as: "placement",
                attributes: ['createdBy'],
                where: { createdBy: emp_name } // 🔥 key condition
              }
            ]
          });

          if (mapping) {
            authorized = true;
          }
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
          'resumePath',
          'offerLetterPath',
          'lastLogin'
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
      logger.error({
        message: 'Error in getById student course record',
        error: error.message,
        stack: error.stack,
        route: req.originalUrl,
        params: req.params,
        user: req.user,
      });
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
        resumeStatus,
        progressStatus,
        searchField,
        searchValue,
        page = 1,
        limit = 10,
        sortBy = 'id',
        sortOrder = 'DESC'
      } = req.query;

      // ================== ✅ BASE FILTERS ==================
      const baseFilters = buildStudentFilters(req.query);

      const whereClause = {
        [Op.and]: [
          baseFilters,
          {
            mentor: emp_name,
            mentorid: empIdStr
          }
        ]
      };

      // ================== ✅ PLACEMENT STATUS ==================
      whereClause[Op.and].push({
        placementStatus: {
          [Op.in]: [
            "Awaiting for placement",
            "Placed but not accepted the Offer"
          ]
        }
      });

      // ================== ✅ PROGRESS STATUS ==================
      if (progressStatus) {
        if (progressStatus !== 'Placed') {
          whereClause[Op.and].push({
            placementStatus: progressStatus
          });
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
            }
          });
        }
      }

      console.log('✅ Mentor WHERE:', JSON.stringify(whereClause, null, 2));

      // ================== ✅ PAGINATION ==================
      const pageNumber = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 10;
      const offset = (pageNumber - 1) * pageSize;

      if (pageNumber < 1 || pageSize < 1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid pagination parameters'
        });
      }

      // ================== ✅ SORTING ==================
      const allowedSortFields = [
        'id', 'courseType', 'courseName',
        'batch', 'learningMode', 'ProgressStatus', 'createdAt'
      ];

      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'id';
      const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : 'DESC';

      // ================== ✅ FETCH ==================
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

      // ================== ✅ REGISTRATION ==================
      const studentIds = rows.map(row => row.studentId);

      let registrationWhereClause = {
        studentId: { [Op.in]: studentIds }
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
        registrationWhereClause.educationCourse = {
          [Op.iLike]: `%${searchValue}%`
        };
      }

      const registrationData = await StudentRegistration.findAll({
        where: registrationWhereClause,
        attributes: ['studentId', 'resumePath', 'educationCourse'],
      });

      // ================== ✅ OPTIONAL FILTER ==================
      let filteredRows = rows;

      if (resumeStatus) {
        const validIds = new Set(registrationData.map(r => r.studentId));
        filteredRows = rows.filter(r => validIds.has(r.studentId));
      }

      // ================== ✅ MAP ==================
      const registrationMap = registrationData.reduce((map, reg) => {
        map[reg.studentId] = reg.toJSON();
        return map;
      }, {});

      const enrichedRows = filteredRows.map(row => ({
        ...row.toJSON(),
        studentRegistration: registrationMap[row.studentId] || null
      }));

      // ================== ✅ PAGINATION ==================
      const totalRecords = resumeStatus ? enrichedRows.length : count;
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
  getMentorExcel: async (req, res) => {
    try {
      const user = req.user;

      if (!user || !user.emp_name || !user.emp_id) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      const { emp_name, emp_id } = user;
      const empIdStr = String(emp_id);

      const {
        resumeStatus,
        progressStatus,
        searchField,
        searchValue
      } = req.query;

      // ================== ✅ BASE FILTERS ==================
      const baseFilters = buildStudentFilters(req.query);

      const whereClause = {
        [Op.and]: [
          baseFilters,
          {
            mentor: emp_name,
            mentorid: empIdStr
          }
        ]
      };

      // ================== ✅ PLACEMENT ==================
      whereClause[Op.and].push({
        placementStatus: {
          [Op.in]: [
            "Awaiting for placement",
            "Placed but not accepted the Offer"
          ]
        }
      });

      // ================== ✅ PROGRESS ==================
      if (progressStatus) {
        if (progressStatus !== "Placed") {
          whereClause[Op.and].push({
            placementStatus: progressStatus
          });
        } else {
          return res.json({ success: true, data: [] });
        }
      }

      console.log("Mentor Excel WHERE:", JSON.stringify(whereClause, null, 2));

      // ================== ✅ FETCH ==================
      const studentCourseResults = await StudentCourse.findAll({
        where: whereClause
      });

      if (!studentCourseResults.length) {
        return res.status(404).json({
          success: false,
          message: "No data found"
        });
      }

      const studentIds = studentCourseResults.map(s => s.studentId);

      const registrationWhereClause = {
        studentId: { [Op.in]: studentIds }
      };

      // Resume filter
      if (resumeStatus === "uploaded") {
        registrationWhereClause.resumePath = { [Op.ne]: null };
      } else if (resumeStatus === "not_uploaded") {
        registrationWhereClause[Op.or] = [
          { resumePath: { [Op.is]: null } },
          { resumePath: "" }
        ];
      }

      if (searchField === "educationCourse" && searchValue) {
        registrationWhereClause.educationCourse = {
          [Op.iLike]: `%${searchValue}%`
        };
      }

      const registrationData = await StudentRegistration.findAll({
        where: registrationWhereClause
      });

      const validIds = new Set(registrationData.map(r => r.studentId));

      let filteredResults = studentCourseResults;

      if (resumeStatus) {
        filteredResults = studentCourseResults.filter(s =>
          validIds.has(s.studentId)
        );
      }

      // ================== ✅ MAP ==================
      const regMap = {};
      registrationData.forEach(r => {
        regMap[r.studentId] = r.toJSON();
      });

      const rows = filteredResults.map(row => ({
        ...row.toJSON(),
        ...regMap[row.studentId]
      }));

      // ================== ✅ EXCEL ==================
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Mentor Students");

      const columns = [
        "studentName", "branch", "Department",
        "courseName", "ProgressStatus", "desiredlocation",
        "studentContactNumber", "email_Id", "resumeStatus"
      ];

      worksheet.columns = columns.map(key => ({
        header: key.toUpperCase(),
        key,
        width: 25
      }));

      rows.forEach(row => {
        worksheet.addRow({
          ...row,
          resumeStatus: row.resumePath ? "Yes" : "No"
        });
      });

      // ================== ✅ RESPONSE ==================
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Mentor_Students.xlsx"`
      );

      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error("Error in getMentorExcel:", error);
      res.status(500).json({
        success: false,
        message: "Excel export failed",
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
    logger.info("=== STAFF UPDATE REQUEST START ===");

    logger.info("Request params:", req.params);
    logger.info("Request body:", req.body);
    logger.info("User from token:", {
      emp_id: req.user?.emp_id,
      emp_name: req.user?.emp_name,
      role: req.user?.role
    });

    try {
      const { id } = req.params;
      const updateData = { ...req.body };
      const updatedBy = 'staff';

      if (Object.keys(updateData).length === 0) {
        logger.warn({
          message: "No data provided for update",
          route: req.originalUrl,
          user: req.user,
          params: req.params,
        });
        return res.status(400).json({
          success: false,
          message: "No data provided for update"
        });
      }

      const existingRecord = await StudentCourse.findByPk(id);
      if (!existingRecord) {
        logger.warn({
          message: "Student course record not found",
          route: req.originalUrl,
          id,
        });
        return res.status(404).json({
          success: false,
          message: "Student course record not found"
        });
      }

      logger.info({
        message: "Existing record details",
        studentId: existingRecord.studentId,
        mentorid: existingRecord.mentorid,
        mentor: existingRecord.mentor,
        knownSkill: existingRecord.knownSkill
      });

      // === Mentor update protection ===
      const mentorFields = ["mentor", "mentorid", "mentorNumber"];
      const tryingToUpdateMentor = mentorFields.some(
        field => field in updateData && updateData[field] !== existingRecord[field]
      );

      if (tryingToUpdateMentor) {
        if (existingRecord.mentorid && req.user.emp_id.toString() !== existingRecord.mentorid.toString()) {
          logger.warn({
            message: "Mentor authorization failed",
            existingMentorId: existingRecord.mentorid,
            currentUserEmpId: req.user.emp_id,
            route: req.originalUrl
          });

          return res.status(403).json({
            success: false,
            message: "You are not authorized to update mentor details"
          });
        }

        logger.info("Mentor authorization passed - proceeding with mentor update");
      }

      // === Skill update formatting ===
      const skillFields = ["knownSkill", "skillSet"];
      const tryingToUpdateSkills = skillFields.some(field => field in updateData);
      let skillsChanged = false;

      if (tryingToUpdateSkills && updateData.knownSkill !== undefined) {
        const newKnownSkills = Array.isArray(updateData.knownSkill)
          ? updateData.knownSkill.join(",")
          : (updateData.knownSkill || "");

        updateData.knownSkill = newKnownSkills;
        updateData.lastSkillUpdateBy = updatedBy;
        updateData.skillUpdateTimestamp = new Date();
        updateData.stuapprove = false;
        updateData.staffapprove = true;
        skillsChanged = true;

        logger.info({
          message: "Skills updated by staff",
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

      // === DATE FIELDS CLEANUP ===
      const dateFields = [
        'courseStartDate', 'courseEndDate',
        'tenthPassout', 'twelfthPassout',
        'diplomaPassout', 'ugPassout', 'pgPassout',
        'joiningDate', 'placementDate',
        'expStartDate1', 'expEndDate1',
        'expStartDate2', 'expEndDate2',
        'expStartDate3', 'expEndDate3', 'readyForPlacementDate'
      ];

      dateFields.forEach(field => {
        if (field in updateData) {
          if (!updateData[field] || updateData[field] === '' || updateData[field] === 'Invalid date') {
            updateData[field] = null;
          }
        }
      });

      // === BOOLEAN FIELDS CLEANUP ===
      const booleanFields = [
        'expCurrentlyWorking1',
        'expCurrentlyWorking2',
        'expCurrentlyWorking3',
        'stuapprove',
        'staffapprove',
      ];

      booleanFields.forEach(field => {
        if (field in updateData) {
          if (
            updateData[field] === "" ||
            updateData[field] === null ||
            updateData[field] === undefined
          ) {
            updateData[field] = false;
          } else {
            updateData[field] =
              updateData[field] === true ||
              updateData[field] === "true" ||
              updateData[field] === 1;
          }
        }
      });

      // === PACKAGE FIX ===
      if ("package" in updateData) {
        if (!updateData.package) {
          updateData.package = null;
        } else {
          updateData.package = parseInt(updateData.package);
          if (isNaN(updateData.package)) updateData.package = null;
        }
      }

      // === GOOGLE REVIEW CLEANUP ===
      if ("googleReviewStars" in updateData) {
        if (
          updateData.googleReviewStars === "" ||
          updateData.googleReviewStars === null ||
          updateData.googleReviewStars === undefined
        ) {
          updateData.googleReviewStars = null;
        } else {
          updateData.googleReviewStars = parseInt(updateData.googleReviewStars, 10);
          if (isNaN(updateData.googleReviewStars)) {
            updateData.googleReviewStars = null;
          }
        }
      }

      if ("googleReview" in updateData) {
        if (updateData.googleReview === "") {
          updateData.googleReview = null;
        }
      }

      if ("googleReviewReason" in updateData) {
        if (updateData.googleReviewReason === "") {
          updateData.googleReviewReason = null;
        }
      }

      // === PLACEMENT STATUS PROTECTION (FIX) ===
      // placementStatus should NEVER be null or empty — always fallback to existing or default
      if ("placementStatus" in updateData) {
        if (!updateData.placementStatus || updateData.placementStatus === "") {
          updateData.placementStatus =
            existingRecord.placementStatus || "Awaiting for placement";
        }
      } else {
        // If placementStatus wasn't sent at all, preserve existing value
        updateData.placementStatus =
          existingRecord.placementStatus || "Awaiting for placement";
      }
      // === PLACEMENT STATUS CHANGE TRACKING ===
      if (
        updateData.placementStatus &&
        updateData.placementStatus !== existingRecord.placementStatus
      ) {
        updateData.placementStatusChangedBy = req.user?.emp_name || req.user?.emp_id?.toString() || "Unknown";
        updateData.placementStatusChangedAt = new Date();
      }
      // Track who modified
      if (req.user?.emp_id) {
        updateData.modified_by = req.user.emp_id;
      }

      logger.info({
        message: "Final update data prepared",
        updateData,
        skillsChanged
      });

      // === Ready For Placement Date Logic ===
      if ("readyForPlacement" in updateData) {

        // Case 1: Changed from No → Yes
        if (
          updateData.readyForPlacement === "Yes" &&
          existingRecord.readyForPlacement !== "Yes"
        ) {
          // Only auto-set if frontend did NOT send a date
          if (!updateData.readyForPlacementDate) {
            updateData.readyForPlacementDate = new Date();
          }
        }

        // Case 2: Changed to No → Clear date only, DO NOT touch placementStatus
        if (updateData.readyForPlacement === "No") {
          updateData.readyForPlacementDate = null;
          // placementStatus is already protected above — no change needed here
        }
      }

      // === UPDATE OPERATION ===
      await StudentCourse.update(updateData, {
        where: { id },
        returning: true
      });

      const updatedRecord = await StudentCourse.findByPk(id);

      logger.info({
        message: "Record updated successfully",
        updatedRecord: {
          mentorid: updatedRecord.mentorid,
          mentor: updatedRecord.mentor,
          mentorNumber: updatedRecord.mentorNumber,
          knownSkill: updatedRecord.knownSkill,
          skillSet: updatedRecord.skillSet,
          stuapprove: updatedRecord.stuapprove,
          staffapprove: updatedRecord.staffapprove,
          placementStatus: updatedRecord.placementStatus
        }
      });

      const studentId = updatedRecord.studentId;

      const registrationUpdate = {};
      ["ParentNo", "address", "dob"].forEach((field) => {
        if (field in req.body) {
          registrationUpdate[field] = req.body[field];
        }
      });

      if ("dob" in registrationUpdate) {
        if (!registrationUpdate.dob || registrationUpdate.dob === "" || registrationUpdate.dob === "Invalid date") {
          registrationUpdate.dob = null;
        }
      }

      logger.info("Updating StudentRegistration with:", registrationUpdate);

      if (Object.keys(registrationUpdate).length > 0) {
        await StudentRegistration.update(registrationUpdate, {
          where: { studentId }
        });
      }

      const message = skillsChanged
        ? "Student course record updated successfully. Skills are pending student approval."
        : "Student course record updated successfully";

      res.json({
        success: true,
        message,
        skillsChanged,
        updatedBy,
        data: updatedRecord,
        skillApprovals: skillsChanged
          ? {
            stuapprove: updatedRecord.stuapprove,
            staffapprove: updatedRecord.staffapprove
          }
          : undefined
      });

    } catch (error) {
      logger.error({
        message: "Error in updating student course record",
        error: error.message,
        stack: error.stack,
        route: req.originalUrl,
        params: req.params,
        user: req.user
      });

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
        resumeStatus,
        searchField,
        searchValue,
        page = 1,
        limit = 10,
        sortBy = "branch",
        sortOrder = "ASC"
      } = req.query;

      // ✅ Base filters (REUSABLE)
      const whereClause = {
        ...buildStudentFilters(req.query),
        readyForPlacement: "Yes",
        placementStatus: { [Op.ne]: "Placed" }
      };

      // ✅ Pagination
      const pageNumber = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 10;
      const offset = (pageNumber - 1) * pageSize;

      // ✅ Sorting setup
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

      // ✅ Fetch (no branch sort here)
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

      // ✅ Add index for stable sort
      studentCourseResults.forEach((item, index) => {
        item.originalIndex = index;
      });

      // ✅ Custom stable sort
      const customSort = (a, b) => {
        const branchCompare = (a.branch || "").localeCompare(b.branch || "");
        if (branchCompare !== 0) return branchCompare;

        const aCompleted = a.ProgressStatus === "Course Completed";
        const bCompleted = b.ProgressStatus === "Course Completed";

        if (aCompleted && !bCompleted) return -1;
        if (!aCompleted && bCompleted) return 1;

        const statusCompare = (a.ProgressStatus || "").localeCompare(b.ProgressStatus || "");
        if (statusCompare !== 0) return statusCompare;

        return a.originalIndex - b.originalIndex;
      };

      if (sortBy === "branch") {
        studentCourseResults.sort(customSort);
      }

      // ✅ Registration filter (fees + resume)
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

      // ✅ Resume filter
      if (resumeStatus === "uploaded") {
        registrationWhereClause.resumePath = { [Op.ne]: null };
      } else if (resumeStatus === "not_uploaded") {
        registrationWhereClause[Op.and] = registrationWhereClause[Op.and] || [];
        registrationWhereClause[Op.and].push({
          [Op.or]: [
            { resumePath: { [Op.is]: null } },
            { resumePath: "" }
          ]
        });
      }

      // ✅ Search fix (NO override bug)
      if (searchField === "educationCourse" && searchValue) {
        registrationWhereClause.educationCourse = {
          [Op.iLike]: `%${searchValue}%`
        };
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
      console.log("Before eligibility filter:", studentCourseResults.length);

      const filteredResults = studentCourseResults.filter(r =>
        eligibleStudentIds.has(r.studentId)
      );
      console.log("After eligibility filter:", filteredResults.length);
      // ✅ Reapply stable sort
      if (sortBy === "branch") {
        filteredResults.sort(customSort);
      }

      // ✅ Pagination AFTER filtering
      const totalRecords = filteredResults.length;
      const paginatedResults = filteredResults.slice(offset, offset + pageSize);

      // ✅ Map registration
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
      logger.error({
        message: "Error in getPlacementEligibleStudents",
        error: error.message,
        stack: error.stack,
        route: req.originalUrl,
        query: req.query,
        user: req.user || null
      });

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
        genders,
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
      const whereClause = { readyForPlacement: "Yes", placementStatus: "Awaiting for placement" };

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
      if (genders) {
        whereClause.gender = {
          [Op.in]: genders.split(",").map(x => x.trim())
        };
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
      if (req.query.fromPassedYear || req.query.toPassedYear) {
        const fromYear = req.query.fromPassedYear;
        const toYear = req.query.toPassedYear || fromYear; // If only fromYear, treat as single year

        const yearConditions = [];

        // UG Passout year
        if (fromYear && toYear) {
          yearConditions.push({
            ugPassout: {
              [Op.and]: [
                { [Op.gte]: fromYear },
                { [Op.lte]: toYear }
              ]
            }
          });
        }

        // PG Passout year
        if (fromYear && toYear) {
          yearConditions.push({
            pgPassout: {
              [Op.and]: [
                { [Op.gte]: fromYear },
                { [Op.lte]: toYear }
              ]
            }
          });
        }

        if (yearConditions.length > 0) {
          if (whereClause[Op.and]) {
            whereClause[Op.and].push({ [Op.or]: yearConditions });
          } else {
            whereClause[Op.and] = [{ [Op.or]: yearConditions }];
          }
        }
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
          "lastLogin",
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
        "placementInterest",
        "staffRemarks",
        "tenthPercentage",
        "twelfthPercentage",
        "ugPercentage",
        "pgPercentage",
        "resumeStatus",
        "readyForPlacementDate",
        "createdAt",
        "lastLogin",
      ];

      // Custom header names
      const customHeaderNames = {
        educationQualification: "Education Qualification",
        passedOutYear: "Passed Out Year",
        mockRemarks: "Mock Interview Remarks",
        experience: "Working Experience",
        staffRemarks: "Additional Notes",
        tenthPercentage: "10 mark",
        twelfthPercentage: "12 mark",
        ugPercentage: "UG Mark",
        pgPercentage: "PG Mark",
        resumeStatus: "Resume Uploaded",
        readyForPlacementDate: "Ready For Placement Date",
        createdAt: "Created Date",
        lastLogin: "Last Login"
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

          // ✅ Resume Column
          if (col === "resumeStatus") {
            rowData[col] =
              row.resumePath && row.resumePath !== ""
                ? "Yes"
                : "";

            // ✅ Ready For Placement Date
          } else if (col === "readyForPlacementDate") {
            rowData[col] = row.readyForPlacementDate
              ? new Date(row.readyForPlacementDate).toISOString().split("T")[0]
              : "";

          } else if (col === "createdAt") {
            rowData[col] = row.createdAt
              ? new Date(row.createdAt).toISOString().split("T")[0]
              : "";

            // ✅ Last Login (Indian Time Format)
          } else if (col === "lastLogin") {
            if (row.lastLogin) {
              const date = new Date(row.lastLogin);

              const day = String(date.getDate()).padStart(2, "0");
              const month = String(date.getMonth() + 1).padStart(2, "0");
              const year = date.getFullYear();

              const time = date.toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "numeric",
                minute: "2-digit",
                hour12: true
              });

              rowData[col] = `${day}-${month}-${year} ${time}`;
            } else {
              rowData[col] = "";
            }

          } else if (col === "educationQualification") {
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
            rowData[col] =
              row[col] && row[col] !== "N/A"
                ? row[col]
                : "";
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
      logger.error({
        message: "❌ Excel export failed",
        error: error.message,
        stack: error.stack,
        route: req.originalUrl,
        query: req.query,
        user: req.user || null
      });
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
        placementStatusFilter = "Placed",  // ✅ NEW - Default to "Placed"
        searchValue,
        photoReview,        // ✅ NEW
        videoReview,        // ✅ NEW
        googleReview,
        page = 1,
        limit = 10,
        sortBy = "branch",
        sortOrder = "ASC"
      } = req.query;

      const whereClause = {
        readyForPlacement: "Yes"
      };

      // ✅ NEW - Handle placement status filter
      if (placementStatusFilter === "All") {
        whereClause.placementStatus = {
          [Op.in]: [
            "Placed",
            "Placed but not accepted the Offer"
          ]
        };
      } else if (placementStatusFilter === "Placed") {
        whereClause.placementStatus = "Placed";
      } else if (placementStatusFilter === "Placed but not accepted the Offer") {
        whereClause.placementStatus = "Placed but not accepted the Offer";
      }


      // ✅ Role-based access control
      const user = req.user;

      if (!user || !user.emp_name) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Invalid user information',
        });
      }

      const { emp_name, emp_id, branch: userBranch, role } = user;
      const empIdStr = String(emp_id);

      // Apply role-based filters
      if (role === 'Super-Admin') {
        // Full access
        if (req.query.branch) {
          whereClause.branch = req.query.branch;
        }

      } else if (role === 'Placement officer') {
        if (req.query.branch) {
          whereClause.branch = req.query.branch;
        }
      } else if (role === 'Branch-head') {
        // Branch-head can see students from their branches
        if (req.query.branch) {
          whereClause.branch = req.query.branch;
        } else if (Array.isArray(userBranch)) {
          whereClause.branch = { [Op.in]: userBranch };
        } else if (userBranch) {
          whereClause.branch = userBranch;
        }
      } else if (role === 'Trainer') {
        // Trainer can only see students they mentor
        whereClause[Op.or] = [
          { [Op.and]: [{ staffName1: emp_name }, { staffId1: empIdStr }] },
          { [Op.and]: [{ staffName2: emp_name }, { staffId2: empIdStr }] },
          { [Op.and]: [{ staffName3: emp_name }, { staffId3: empIdStr }] },
          { [Op.and]: [{ mentor: emp_name }, { mentorid: empIdStr }] }

        ];
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Insufficient permissions'
        });
      }

      // Department filter
      if (departments) {
        whereClause.Department = {
          [Op.in]: departments.split(",").map(v => v.trim())
        };
      }

      // Placement filters
      if (placedBy) {
        const placedByArray = placedBy
          .split(",")
          .map(v => v.trim());

        whereClause.placedBy = {
          [Op.in]: placedByArray
        };
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
      const reviewOrConditions = [];

      // ✅ NEW - Photo Review Filter
      if (photoReview) {
        if (photoReview === "Yes") {
          whereClause.photoReview = "Yes";
        } else if (photoReview === "No") {
          whereClause.photoReview = "No";
        } else if (photoReview === "not_filled") {
          reviewOrConditions.push(
            { photoReview: { [Op.is]: null } },
            { photoReview: "" }
          );
        }
      }

      // ✅ NEW - Video Review Filter (3 options)
      if (videoReview) {
        if (videoReview === "Yes") {
          whereClause.videoReview = "Yes";
        } else if (videoReview === "No") {
          whereClause.videoReview = "No";
        } else if (videoReview === "not_filled") {
          reviewOrConditions.push(
            { videoReview: { [Op.is]: null } },
            { videoReview: "" }
          );
        }
      }

      // ✅ NEW - Google Review Filter (3 options)
      if (googleReview) {
        if (googleReview === "Yes") {
          whereClause.googleReview = "Yes";
        } else if (googleReview === "No") {
          whereClause.googleReview = "No";
        } else if (googleReview === "not_filled") {
          reviewOrConditions.push(
            { googleReview: { [Op.is]: null } },
            { googleReview: "" }
          );
        }
      }
      if (reviewOrConditions.length > 0) {
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push({
          [Op.or]: reviewOrConditions
        });
      }
      // Date validation and filtering
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

      console.log("Applied Date Filter ->", whereClause.placementDate);
      console.log('Placed Students Where Clause:', JSON.stringify(whereClause, null, 2));

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

      // Branch Filter (additional to role-based filter)
      if (branches) {
        whereClause.branch = {
          [Op.in]: branches.split(",").map(v => v.trim())
        };
      } else if (req.query.branch && role !== 'Branch-head') {
        // Only apply if not already handled by Branch-head logic
        whereClause.branch = req.query.branch;
      }

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
        "package", "createdAt", "updatedAt",
        "photoReview", "videoReview", "googleReview"  // ✅ NEW
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
        branches,
        courses,
        placedBy,
        companyName,
        placementDateFrom,
        placementDateTo,
        packageRange,
        placementStatusFilter = "Placed",
        photoReview,        // ✅ NEW
        videoReview,        // ✅ NEW
        googleReview,
        searchField,
        searchValue,
      } = req.query;

      // Base condition
      // Base condition
      const whereClause = {
        readyForPlacement: "Yes"
      };

      // ✅ NEW - Handle placement status filter
      if (placementStatusFilter === "All") {
        whereClause.placementStatus = {
          [Op.in]: [
            "Placed",
            "Placed but not accepted the Offer"
          ]
        };
      } else if (placementStatusFilter === "Placed") {
        whereClause.placementStatus = "Placed";
      } else if (placementStatusFilter === "Placed but not accepted the Offer") {
        whereClause.placementStatus = "Placed but not accepted the Offer";
      }
      // ✅ Role-based access control
      const user = req.user;

      if (!user || !user.emp_name) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Invalid user information',
        });
      }

      const { emp_name, emp_id, branch: userBranch, role } = user;
      const empIdStr = String(emp_id);

      // Apply role-based filters
      if (role === 'Super-Admin') {
      } else if (role === 'Placement officer') {
        if (req.query.branch) {
          whereClause.branch = req.query.branch;
        }
      } else if (role === 'Branch-head') {
        // Branch-head can see students from their branches
        if (req.query.branch) {
          whereClause.branch = req.query.branch;
        } else if (Array.isArray(userBranch)) {
          whereClause.branch = { [Op.in]: userBranch };
        } else if (userBranch) {
          whereClause.branch = userBranch;
        }
      } else if (role === 'Trainer') {
        // Trainer can only see students they mentor
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

      // Department filter
      if (departments) {
        whereClause.Department = {
          [Op.in]: departments.split(",").map(v => v.trim())
        };
      }

      // Course filter
      if (courses) {
        whereClause.courseName = {
          [Op.in]: courses.split(",").map(v => v.trim())
        };
      }

      // Branch filter (additional to role-based filter)
      if (branches && role !== 'Branch-head') {
        whereClause.branch = {
          [Op.in]: branches.split(",").map(v => v.trim())
        };
      }

      // Placed By (Multi-Select Support)
      if (placedBy) {
        const placedByArray = placedBy
          .split(",")
          .map(v => v.trim());

        whereClause.placedBy = {
          [Op.in]: placedByArray
        };
      }

      // Company Name Search
      if (companyName) {
        whereClause.companyName = { [Op.iLike]: `%${companyName}%` };
      }
      const reviewOrConditions = [];

      // ✅ NEW - Photo Review Filter
      if (photoReview) {
        if (photoReview === "Yes") {
          whereClause.photoReview = "Yes";
        } else if (photoReview === "No") {
          whereClause.photoReview = "No";
        } else if (photoReview === "not_filled") {
          reviewOrConditions.push(
            { photoReview: { [Op.is]: null } },
            { photoReview: "" }
          );
        }
      }

      // ✅ NEW - Video Review Filter (3 options)
      if (videoReview) {
        if (videoReview === "Yes") {
          whereClause.videoReview = "Yes";
        } else if (videoReview === "No") {
          whereClause.videoReview = "No";
        } else if (videoReview === "not_filled") {
          reviewOrConditions.push(
            { videoReview: { [Op.is]: null } },
            { videoReview: "" }
          );
        }
      }

      // ✅ NEW - Google Review Filter (3 options)
      if (googleReview) {
        if (googleReview === "Yes") {
          whereClause.googleReview = "Yes";
        } else if (googleReview === "No") {
          whereClause.googleReview = "No";
        } else if (googleReview === "not_filled") {
          reviewOrConditions.push(
            { googleReview: { [Op.is]: null } },
            { googleReview: "" }
          );
        }
      }
      if (reviewOrConditions.length > 0) {
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push({
          [Op.or]: reviewOrConditions
        });
      }

      // Placement Date Range (Validation included)
      const isValidDate = (d) => !isNaN(new Date(d).getTime());

      if (placementDateFrom && placementDateTo && isValidDate(placementDateFrom) && isValidDate(placementDateTo)) {
        whereClause.placementDate = { [Op.between]: [placementDateFrom, placementDateTo] };
      } else if (placementDateFrom && isValidDate(placementDateFrom)) {
        whereClause.placementDate = { [Op.gte]: placementDateFrom };
      } else if (placementDateTo && isValidDate(placementDateTo)) {
        whereClause.placementDate = { [Op.lte]: placementDateTo };
      }

      // Package Range
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
        }
      }

      // Search filter
      if (searchField && searchValue) {
        whereClause[searchField] = { [Op.iLike]: `%${searchValue}%` };
      }

      console.log("Excel whereClause:", JSON.stringify(whereClause, null, 2));
      const formatDateTime = (dateStr) => {
        if (!dateStr) return "";

        const date = new Date(dateStr);

        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();

        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, "0");

        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;

        return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
      };
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
      // Registration filter (same as main controller)
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

      const registrationData = await StudentRegistration.findAll({
        where: registrationWhereClause,
        attributes: [
          "studentId",
          "resumePath",
          "offerLetterPath",
          "educationCourse",
          "pendingFees",
          "pendingFees2",
          "pendingFees3",
          "pendingFees4",
        ]
      });

      const eligibleStudentIds = new Set(registrationData.map(r => r.studentId));

      // Filter StudentCourse results
      let filteredStudentCourseResults = studentCourseResults;

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
        "Department",
        "courseName",
        "placementStatus",
        "placementDate",
        "placedBy",
        "package",
        "companyName",
        "companyLocation",
        "jobRole",
        "joiningDate",
        "placementRemarks",
        "offerLetterPath",
        "knownSkill",
        "studentContactNumber",
        "mentor",
        "mentorNumber",
        "photoReview",
        "photoReviewLink",
        "photoReviewReason",
        "videoReview",
        "videoReviewLink",
        "videoReviewReason",
        "googleReview",
        "googleReviewStars",
        "googleReviewReason",
        "placementStatusChangedBy",
        "placementStatusChangedAt",
      ];

      // Custom header names
      const customHeaderNames = {
        placementDate: "Placed Date",
        offerLetterPath: "Offer Letter"
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
          } else if (col === "offerLetterPath") {
            rowData[col] = row.offerLetterPath ? "Yes" : "";
          } else if (col === "placementStatusChangedAt") {
            rowData[col] = formatDateTime(row[col]);
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

  getPlacedStudentsReport: async (req, res) => {
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
        sortBy = "branch",
        sortOrder = "ASC",
      } = req.query;

      // Base condition (same as original controller)
      const whereClause = {
        readyForPlacement: "Yes",
        placementStatus: "Placed",
      };

      // Department filter
      if (departments) {
        whereClause.Department = {
          [Op.in]: departments.split(",").map((v) => v.trim()),
        };
      }

      // Branch filter
      if (branches) {
        whereClause.branch = {
          [Op.in]: branches.split(",").map((v) => v.trim()),
        };
      }

      // Course Filters
      if (courseTypes) {
        whereClause.courseType = {
          [Op.in]: courseTypes.split(",").map((v) => v.trim()),
        };
      } else if (courseType) whereClause.courseType = courseType;

      if (courseNames) {
        whereClause.courseName = {
          [Op.in]: courseNames.split(",").map((v) => v.trim()),
        };
      } else if (courseName) whereClause.courseName = courseName;

      // Placed By
      if (placedBy) {
        whereClause.placedBy = { [Op.iLike]: `%${placedBy}%` };
      }

      // Company
      if (companyName) {
        whereClause.companyName = { [Op.iLike]: `%${companyName}%` };
      }

      // Package filter (same as your existing logic)
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
        }
      }

      // Date filter
      const isValidDate = (date) => !isNaN(new Date(date).getTime());

      if (
        placementDateFrom &&
        placementDateTo &&
        isValidDate(placementDateFrom) &&
        isValidDate(placementDateTo)
      ) {
        whereClause.placementDate = {
          [Op.between]: [placementDateFrom, placementDateTo],
        };
      } else if (placementDateFrom && isValidDate(placementDateFrom)) {
        whereClause.placementDate = {
          [Op.gte]: placementDateFrom,
        };
      } else if (placementDateTo && isValidDate(placementDateTo)) {
        whereClause.placementDate = {
          [Op.lte]: placementDateTo,
        };
      }

      // Search
      if (searchField && searchValue) {
        whereClause[searchField] = { [Op.iLike]: `%${searchValue}%` };
      }

      // Sorting (same style)
      const allowedSortFields = [
        "id",
        "courseType",
        "courseName",
        "branch",
        "placedBy",
        "package",
        "placementDate",
      ];

      const sortField = allowedSortFields.includes(sortBy) ? sortBy : "branch";
      const sortDirection = ["ASC", "DESC"].includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "ASC";

      // Fetch all placed students (no pagination)
      const placedResults = await StudentCourse.findAll({
        where: whereClause,
        order: sortBy === "branch" ? [] : [[sortField, sortDirection]],
      });

      // Stable sorting logic (just like your other controllers)
      placedResults.forEach((item, index) => {
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
        placedResults.sort(customSort);
      }

      return res.json({
        success: true,
        totalRecords: placedResults.length,
        data: placedResults.map((r) => r.toJSON()),
      });
    } catch (error) {
      console.error("Report Error: ", error);
      res.status(500).json({
        success: false,
        message: "Report generation failed",
        error: error.message,
      });
    }
  },

  downloadAllStudentsForExcel: async (req, res) => {
    try {
      const {
        courseType,
        courseName,
        batch,
        learningMode,
        progressStatus,
        searchField,
        searchValue,
        sortBy = 'id',
        sortOrder = 'DESC'
      } = req.query;

      const whereClause = {};
      const user = req.user;

      if (!user || !user.emp_name) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const { emp_name, emp_id, branch: userBranch, role } = user;
      const empIdStr = String(emp_id);

      // 🔐 ROLE BASED ACCESS (same logic, no pagination)
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
          message: 'Insufficient permissions'
        });
      }

      // 🚫 Exclude placed students
      whereClause.ProgressStatus = {
        [Op.notIn]: ['Course Completed, Certified, and Successfully Placed']
      };

      // 🔍 Filters
      if (courseType) whereClause.courseType = courseType;
      if (courseName) whereClause.courseName = courseName;
      if (batch) whereClause.batch = batch;
      if (learningMode) whereClause.learningMode = learningMode;

      if (progressStatus) {
        whereClause.ProgressStatus = progressStatus;
      }

      // 🔎 Search
      if (searchField && searchValue) {
        whereClause[searchField] = {
          [Op.iLike]: `%${searchValue}%`
        };
      }

      // 🔃 Sorting
      const allowedSortFields = [
        'id', 'courseType', 'courseName', 'batch',
        'learningMode', 'ProgressStatus', 'createdAt'
      ];

      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'id';
      const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // 🚀 FETCH ALL (NO LIMIT / OFFSET)
      const rows = await StudentCourse.findAll({
        where: whereClause,
        order: [[sortField, sortDirection]],
        logging: false
      });

      // 🔗 Fetch StudentRegistration data
      const studentIds = rows.map(r => r.studentId);

      const registrationData = await StudentRegistration.findAll({
        where: { studentId: { [Op.in]: studentIds } },
        attributes: [
          'studentId',
          'resumePath',
          'educationCourse',
          'dob',
          'ParentNo',
          'address'
        ]
      });

      const registrationMap = registrationData.reduce((acc, reg) => {
        acc[reg.studentId] = reg.toJSON();
        return acc;
      }, {});

      const enrichedRows = rows.map(row => ({
        ...row.toJSON(),
        studentRegistration: registrationMap[row.studentId] || null
      }));

      return res.json({
        success: true,
        totalRecords: enrichedRows.length,
        data: enrichedRows
      });

    } catch (error) {
      console.error('Excel download error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download student records',
        error: error.message
      });
    }
  },
  sendLoginReminder: async (req, res) => {
    try {

      const studentCourses = await StudentCourse.findAll({
        attributes: ["studentId", "email_Id"],
        where: {
          readyForPlacement: "Yes",
          placementStatus: "Awaiting for placement"
        }
      });

      if (!studentCourses.length) {
        return res.json({
          success: true,
          message: "No students found"
        });
      }

      const studentIds = studentCourses.map(s => s.studentId);

      const registrations = await StudentRegistration.findAll({
        attributes: ["studentId"],
        where: {
          studentId: { [Op.in]: studentIds },
          lastLogin: null
        }
      });

      const notLoggedInIds = new Set(registrations.map(r => r.studentId));

      const students = studentCourses.filter(s =>
        notLoggedInIds.has(s.studentId)
      );

      let sent = 0;
      let failed = 0;

      const batchSize = 50;

      for (let i = 0; i < students.length; i += batchSize) {

        const batch = students.slice(i, i + batchSize);

        const results = await Promise.allSettled(
          batch.map(student =>
            sendStudentLoginReminder(student.email_Id, student.studentId)
          )
        );

        results.forEach(result => {
          if (result.status === "fulfilled") sent++;
          else failed++;
        });

        console.log(`Batch ${i / batchSize + 1} completed`);
      }

      res.json({
        success: true,
        totalStudents: students.length,
        emailsSent: sent,
        failedEmails: failed
      });

    } catch (error) {

      console.error("Reminder error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to send reminders",
        error: error.message
      });

    }
  }
};
module.exports = studentCourseController;