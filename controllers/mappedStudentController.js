const MappedStudent = require('../models/Mappedstudents');
const StudentCourse = require('../models/StudentCourse');
const StudentRegistration = require('../models/studenReg');
const Placement = require('../models/Placement');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const logger = require("../logger");


const mappedStudentController = {
  // POST - Map student to company
  mapStudent: async (req, res) => {
    try {
      const {
        companyId,
        companyName,
        studentId,
        interviewDate: rawInterviewDate,
        currentStatus = 'Assigned',
        feedback = null,
        notes = null
      } = req.body;

      // 🔒 validate required fields
      if (!companyId || !companyName || !studentId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID, Company Name, and Student ID are required fields'
        });
      }

      // 🔍 normalize interviewDate -------------------------------
      let interviewDate = null;

      if (rawInterviewDate && rawInterviewDate !== 'Invalid date') {
        const d = new Date(rawInterviewDate);

        if (!isNaN(d.getTime())) {
          // store as YYYY-MM-DD for DATEONLY column
          interviewDate = d.toISOString().slice(0, 10);
        }
      }
      // -----------------------------------------------------------

      // 🔁 duplicate mapping check
      const existingMapping = await MappedStudent.findOne({
        where: { companyId, studentId }
      });

      if (existingMapping) {
        return res.status(409).json({
          success: false,
          message: 'Student is already mapped to this company'
        });
      }

      const statusHistory = [{
        status: currentStatus,
        feedback,
        timestamp: new Date(),
        previousStatus: null
      }];

      const newMappedStudent = await MappedStudent.create({
        companyId,
        companyName,
        studentId,
        interviewDate,         // ✔ always valid or null now
        currentStatus,
        feedback,
        notes,
        statusHistory,
        lastStatusUpdate: new Date()
      });

      return res.status(201).json({
        success: true,
        message: 'Student successfully mapped to company',
        data: newMappedStudent
      });

    } catch (error) {
      console.error('Error mapping student:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // DELETE - Unmap student from company
  unmapStudent: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Mapping ID is required'
        });
      }

      const mappedStudent = await MappedStudent.findByPk(id);

      if (!mappedStudent) {
        return res.status(404).json({
          success: false,
          message: 'Mapped student not found'
        });
      }

      await mappedStudent.destroy();

      res.status(200).json({
        success: true,
        message: 'Student successfully unmapped from company'
      });

    } catch (error) {
      console.error('Error unmapping student:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Alternative DELETE - Unmap by companyId and studentId
  unmapStudentByIds: async (req, res) => {
    try {
      const { companyId, studentId } = req.body;

      if (!companyId || !studentId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID and Student ID are required'
        });
      }

      const mappedStudent = await MappedStudent.findOne({
        where: {
          companyId,
          studentId
        }
      });

      if (!mappedStudent) {
        return res.status(404).json({
          success: false,
          message: 'Mapping not found'
        });
      }

      await mappedStudent.destroy();

      res.status(200).json({
        success: true,
        message: 'Student successfully unmapped from company'
      });

    } catch (error) {
      console.error('Error unmapping student:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // GET - Get mapped students by company ID
  getMappedStudentsByCompanyId: async (req, res) => {
    try {
      const { companyId } = req.params;
      const { status } = req.query;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required'
        });
      }

      // 🔹 1) get placement to know required skills
      const placement = await Placement.findOne({
        where: { jobReqId: companyId }
      });

      const skillsToMatch = placement?.skillSet
        ? placement.skillSet.split(',')
          .map(s => s.trim().toLowerCase())
          .filter(Boolean)
        : [];

      // 🔹 2) get mapped students
      const whereClause = { companyId };
      if (status) whereClause.currentStatus = status;

      const mappedStudents = await MappedStudent.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'studentId', 'currentStatus', 'interviewDate', 'companyId', 'feedback']
      });

      if (!mappedStudents.length) {
        return res.status(200).json({
          success: true,
          count: 0,
          data: []
        });
      }

      // 🔹 3) fetch only required StudentCourse fields (edit your 15 columns here)
      const studentIds = mappedStudents.map(ms => ms.studentId);

      // 🔹 3) fetch only required StudentCourse fields (your 15 columns)
      const students = await StudentCourse.findAll({
        where: { studentId: { [Op.in]: studentIds } },
        attributes: [
          'studentId',
          'studentName',
          'branch',
          'courseName',
          'desiredlocation',
          'ugDegree',
          'ugPassout',
          'pgDegree',
          'pgPassout',
          'knownSkill',          // required for match score
          'experience',
          'diplomaDepartment',
          'diplomaPassout',
          'ugDepartment',
          'pgDepartment',
          'id'
        ]
      });

      // 🔹 4) build lookup
      const studentMap = {};
      students.forEach(s => {
        studentMap[s.studentId] = s.toJSON();
      });

      // 🔹 5) merge + compute match score
      const enriched = mappedStudents.map(ms => {
        const s = studentMap[ms.studentId] || {};

        // student skills
        const studentSkills = s.knownSkill
          ? s.knownSkill.split(',')
            .map(x => x.trim().toLowerCase())
            .filter(Boolean)
          : [];

        // skill matching
        let matchCount = 0;
        const matchedSkills = [];

        skillsToMatch.forEach(req => {
          studentSkills.forEach(st => {
            if (st.includes(req) || req.includes(st)) {
              if (!matchedSkills.includes(st)) {
                matchedSkills.push(st);
                matchCount++;
              }
            }
          });
        });

        const matchScore =
          skillsToMatch.length > 0
            ? Math.round((matchCount / skillsToMatch.length) * 100)
            : 0;

        return {
          // mapping table
          mappingId: ms.id,
          companyId: ms.companyId,
          currentStatus: ms.currentStatus,
          interviewDate: ms.interviewDate,
          feedback: ms.feedback,

          // student course fields
          ...s,

          // computed values
          matchScore: Math.min(matchScore, 100),
          matchedSkills,
          totalRequiredSkills: skillsToMatch.length,
          totalMatchedSkills: matchCount
        };
      });

      res.status(200).json({
        success: true,
        count: enriched.length,
        data: enriched
      });

    } catch (error) {
      console.error('Error fetching mapped students by company ID:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },
  getMappedStudentsByCompanyIdExcel: async (req, res) => {
    try {
      const { companyId } = req.params;
      const { status } = req.query;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required'
        });
      }

      // 1) Get placement details
      const placement = await Placement.findOne({
        where: { jobReqId: companyId }
      });

      if (!placement) {
        return res.status(404).json({
          success: false,
          message: 'Placement not found'
        });
      }

      const skillsToMatch = placement.skillSet
        ? placement.skillSet.split(',')
          .map(s => s.trim().toLowerCase())
          .filter(Boolean)
        : [];

      // 2) Get mapped students
      const whereClause = { companyId };
      if (status) whereClause.currentStatus = status;

      const mappedStudents = await MappedStudent.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'studentId', 'currentStatus', 'interviewDate', 'companyId', 'feedback']
      });

      if (!mappedStudents.length) {
        return res.status(404).json({
          success: false,
          message: "No mapped students found"
        });
      }

      const studentIds = mappedStudents.map(ms => ms.studentId);

      // 3) Fetch StudentCourse data with all required fields
      const studentCourseResults = await StudentCourse.findAll({
        where: { studentId: { [Op.in]: studentIds } },
        attributes: [
          'studentId',
          'studentName',
          'branch',
          'courseName',
          'ProgressStatus',
          'desiredlocation',
          'knownSkill',
          'experience',
          'Department',
          'technicalScore',
          'technologyRemarks',
          'communicationScore',
          'communicationRemarks',
          'mockInterview',
          'mockRemarks',
          'project1Score',
          'project2Score',
          'project3Score',
          'mockTest1Score',
          'mockTest2Score',
          'mockTest3Score',
          'courseStartDate',
          'courseEndDate',
          'studentContactNumber',
          'email_Id',
          'gender',
          'mentor',
          'mentorNumber',
          'placementInterest',
          'staffRemarks',
          'diplomaDegree',
          'diplomaPassout',
          'ugDegree',
          'ugPassout',
          'pgDegree',
          'pgPassout',
          'tenthPercentage',
          'twelfthPercentage',
          'ugPercentage',
          'pgPercentage'
        ]
      });

      // 4) Custom sort function (same as placement eligible)
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

      studentCourseResults.sort(customExcelSort);

      // 5) Fetch registration data
      const registrationData = await StudentRegistration.findAll({
        where: {
          studentId: { [Op.in]: studentIds }
        },
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

      // 6) Build lookups
      const studentCourseMap = {};
      studentCourseResults.forEach(s => {
        studentCourseMap[s.studentId] = s.toJSON();
      });

      const regMap = {};
      registrationData.forEach(r => {
        regMap[r.studentId] = r.toJSON();
      });

      const mappedStudentMap = {};
      mappedStudents.forEach(ms => {
        mappedStudentMap[ms.studentId] = ms.toJSON();
      });

      // 7) Calculate match scores and merge data
      const enrichedData = studentCourseResults.map(student => {
        const s = student.toJSON();
        const mappingInfo = mappedStudentMap[s.studentId] || {};
        const regInfo = regMap[s.studentId] || {};

        // Calculate match score
        const studentSkills = s.knownSkill
          ? s.knownSkill.split(',')
            .map(x => x.trim().toLowerCase())
            .filter(Boolean)
          : [];

        let matchCount = 0;
        const matchedSkills = [];

        skillsToMatch.forEach(req => {
          studentSkills.forEach(st => {
            if (st.includes(req) || req.includes(st)) {
              if (!matchedSkills.includes(st)) {
                matchedSkills.push(st);
                matchCount++;
              }
            }
          });
        });

        const matchScore = skillsToMatch.length > 0
          ? Math.min(Math.round((matchCount / skillsToMatch.length) * 100), 100)
          : 0;

        return {
          ...s,
          ...regInfo,
          currentStatus: mappingInfo.currentStatus,
          interviewDate: mappingInfo.interviewDate,
          feedback: mappingInfo.feedback,
          matchScore,
          matchedSkills: matchedSkills.join(', ')
        };
      });

      // Re-sort after merging
      enrichedData.sort(customExcelSort);

      // 8) Define Excel columns (same as placement eligible + mapping fields)
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
        "matchScore",
        "matchedSkills",
        "currentStatus",
        "interviewDate",
        "feedback",
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
        "pgPercentage"
      ];

      // 9) Custom header names
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
        matchScore: "Match Score (%)",
        matchedSkills: "Matched Skills",
        currentStatus: "Interview Status",
        interviewDate: "Interview Date"
      };

      const prettifyHeader = key =>
        key
          .replace(/([A-Z])/g, " $1")
          .replace(/_/g, " ")
          .replace(/\b\w/g, l => l.toUpperCase())
          .trim();

      // 10) Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Mapped Students");

      worksheet.columns = combinedColumns.map(key => ({
        header: customHeaderNames[key] || prettifyHeader(key),
        key,
        width: 25
      }));

      // 11) Add rows
      enrichedData.forEach(row => {
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
          } else if (col === "interviewDate") {
            rowData[col] = row[col] ? new Date(row[col]).toLocaleDateString() : "";
          } else {
            rowData[col] = row[col] && row[col] !== "N/A" ? row[col] : "";
          }
        });

        worksheet.addRow(rowData);
      });

      // 12) Header styling
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };

      // 13) Add borders to all cells
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

      // 14) Set response headers
      const rawCompanyName = placement.companyName || companyId;

      // 🔒 sanitize company name
      const safeCompanyName = rawCompanyName
        .replace(/[^a-zA-Z0-9]/g, "_")   // replace spaces & special chars
        .replace(/_+/g, "_")             // collapse multiple underscores
        .replace(/^_|_$/g, "");          // trim leading/trailing underscore

      const fileName = `Mapped_Students_${safeCompanyName}_${new Date()
        .toISOString()
        .split("T")[0]}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      // ✅ UTF-8 safe + Windows safe
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );


      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      logger.error({
        message: "❌ Mapped students Excel export failed",
        error: error.message,
        stack: error.stack,
        route: req.originalUrl,
        params: req.params,
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
  // GET - Get mapped companies by student ID
  getMappedCompaniesByStudentId: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { status } = req.query; // Optional filter by status

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required'
        });
      }

      // Build where clause
      const whereClause = { studentId };
      if (status) {
        whereClause.currentStatus = status;
      }

      // Get mapped companies
      const mappedCompanies = await MappedStudent.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']]
      });

      if (mappedCompanies.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No company mappings found',
          data: []
        });
      }

      // Get unique company IDs
      const companyIds = mappedCompanies.map(mapping => mapping.companyId);

      // Fetch placement details
      const placements = await Placement.findAll({
        where: {
          id: {
            [Op.in]: companyIds
          }
        }
      });

      // Create placement lookup map
      const placementMap = {};
      placements.forEach(placement => {
        placementMap[placement.id] = placement;
      });

      // Combine data
      const enrichedData = mappedCompanies.map(mapping => {
        const mappingData = mapping.toJSON();
        const placement = placementMap[mapping.companyId];

        return {
          ...mappingData,
          placementDetails: placement || null
        };
      });

      res.json({
        success: true,
        count: mappedCompanies.length,
        data: enrichedData
      });

    } catch (error) {
      console.error('Error fetching mapped companies by student ID:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // PUT - Update status
  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { currentStatus, feedback, notes } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Mapping ID is required'
        });
      }

      if (!currentStatus) {
        return res.status(400).json({
          success: false,
          message: 'Current status is required'
        });
      }

      const mappedStudent = await MappedStudent.findByPk(id);

      if (!mappedStudent) {
        return res.status(404).json({
          success: false,
          message: 'Mapped student not found'
        });
      }

      // statuses that require feedback
      const FEEDBACK_REQUIRED = [
        'Cancelled',
        'Not Selected',
        'Rejected By Student',
        'Rejected the Offer'
      ];

      let newFeedback = null;

      // if status requires feedback, store it
      if (FEEDBACK_REQUIRED.includes(currentStatus)) {
        newFeedback = feedback || null;
      }

      await mappedStudent.update({
        currentStatus,
        feedback: newFeedback,  // <-- always controlled here
        notes: notes ?? mappedStudent.notes
      });

      res.json({
        success: true,
        message: 'Status updated successfully',
        data: mappedStudent
      });

    } catch (error) {
      console.error('Error updating status:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // PUT - Update status by companyId and studentId
  updateStatusByIds: async (req, res) => {
    try {
      const { companyId, studentId, currentStatus, feedback, notes } = req.body;

      if (!companyId || !studentId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID and Student ID are required'
        });
      }

      if (!currentStatus) {
        return res.status(400).json({
          success: false,
          message: 'Current status is required'
        });
      }

      const mappedStudent = await MappedStudent.findOne({
        where: {
          companyId,
          studentId
        }
      });

      if (!mappedStudent) {
        return res.status(404).json({
          success: false,
          message: 'Mapping not found'
        });
      }

      // Update data
      const updateData = {
        currentStatus,
        feedback: feedback || mappedStudent.feedback,
        notes: notes !== undefined ? notes : mappedStudent.notes
      };

      await mappedStudent.update(updateData);

      res.json({
        success: true,
        message: 'Status updated successfully',
        data: mappedStudent
      });

    } catch (error) {
      console.error('Error updating status:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // GET - Get status history
  getStatusHistory: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Mapping ID is required'
        });
      }

      const mappedStudent = await MappedStudent.findByPk(id, {
        attributes: ['id', 'companyId', 'companyName', 'studentId', 'currentStatus', 'statusHistory', 'lastStatusUpdate']
      });

      if (!mappedStudent) {
        return res.status(404).json({
          success: false,
          message: 'Mapped student not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: mappedStudent.id,
          companyId: mappedStudent.companyId,
          companyName: mappedStudent.companyName,
          studentId: mappedStudent.studentId,
          currentStatus: mappedStudent.currentStatus,
          lastStatusUpdate: mappedStudent.lastStatusUpdate,
          statusHistory: mappedStudent.statusHistory || []
        }
      });

    } catch (error) {
      console.error('Error fetching status history:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // GET - Get all mapped students (admin view)
  getAllMappedStudents: async (req, res) => {
    try {
      const { status, companyId, studentId } = req.query;

      // Build where clause based on query params
      const whereClause = {};
      if (status) whereClause.currentStatus = status;
      if (companyId) whereClause.companyId = companyId;
      if (studentId) whereClause.studentId = studentId;

      const mappedStudents = await MappedStudent.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']]
      });

      res.status(200).json({
        success: true,
        count: mappedStudents.length,
        data: mappedStudents
      });

    } catch (error) {
      console.error('Error fetching all mapped students:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // GET - Get single mapping details
  getMappingById: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Mapping ID is required'
        });
      }

      const mappedStudent = await MappedStudent.findByPk(id);

      if (!mappedStudent) {
        return res.status(404).json({
          success: false,
          message: 'Mapping not found'
        });
      }

      // Get student details
      const studentDetails = await StudentCourse.findOne({
        where: { studentId: mappedStudent.studentId },
        attributes: ['studentId', 'studentName', 'branch']
      });

      // Get placement details
      const placement = await Placement.findByPk(mappedStudent.companyId);

      res.json({
        success: true,
        data: {
          ...mappedStudent.toJSON(),
          studentDetails: studentDetails || null,
          placementDetails: placement || null
        }
      });

    } catch (error) {
      console.error('Error fetching mapping details:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  getStudentHistory: async (req, res) => {
    try {
      const { studentId } = req.params;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required'
        });
      }

      // Get all mappings for this student
      const mappings = await MappedStudent.findAll({
        where: { studentId },
        order: [['createdAt', 'DESC']]
      });

      if (!mappings || mappings.length === 0) {
        return res.json({
          success: true,
          message: 'No placement history found for this student',
          data: []
        });
      }

      // Get all unique company IDs
      const companyIds = [...new Set(mappings.map(m => m.companyId))];

      // Fetch all placement details in one query
      const placements = await Placement.findAll({
        where: {
          jobReqId: {
            [Op.in]: companyIds
          }
        }
      });

      // Create a map for quick lookup
      const placementMap = {};
      placements.forEach(p => {
        placementMap[p.jobReqId] = p;
      });

      // Combine mapping data with placement details
      const history = mappings.map(mapping => {
        const placement = placementMap[mapping.companyId];
        return {
          id: mapping.id,
          companyName: mapping.companyName,
          companyId: mapping.companyId,
          interviewDate: mapping.interviewDate,
          currentStatus: mapping.currentStatus,
          feedback: mapping.feedback,
          notes: mapping.notes,
          createdAt: mapping.createdAt,
          lastStatusUpdate: mapping.lastStatusUpdate,
          statusHistory: mapping.statusHistory,
          // Additional placement details if needed
          jobRole: placement?.jobRole || null,
          location: placement?.location || null,
          package: placement?.package || null
        };
      });

      res.json({
        success: true,
        data: history,
        totalMappings: history.length
      });

    } catch (error) {
      console.error('Error fetching student history:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },
  // Get detailed status history for a specific mapping
  getMappingStatusHistory: async (req, res) => {
    try {
      const { mappingId } = req.params;

      const mapping = await MappedStudent.findByPk(mappingId);

      if (!mapping) {
        return res.status(404).json({
          success: false,
          message: 'Mapping not found'
        });
      }

      res.json({
        success: true,
        data: {
          mappingId: mapping.id,
          companyName: mapping.companyName,
          currentStatus: mapping.currentStatus,
          statusHistory: mapping.statusHistory || []
        }
      });

    } catch (error) {
      console.error('Error fetching mapping status history:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },
};

module.exports = mappedStudentController;