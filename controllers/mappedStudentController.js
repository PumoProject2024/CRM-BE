const MappedStudent = require('../models/Mappedstudents');
const StudentCourse = require('../models/StudentCourse');
const { sendMappingEmail } = require("../utils/sendMappingEmail");
const { sendUnmappingEmail } = require("../utils/sendUnmappingEmail");
const { sendStatusUpdateEmail } = require('../utils/sendStatusUpdateEmail');
const StudentRegistration = require('../models/studenReg');
const Placement = require('../models/Placement');
const admin = require('../firebaseAdmin');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const logger = require("../logger");
const StudentDeviceToken = require("../models/StudentDeviceToken");

const mappedStudentController = {

  mapStudent: async (req, res) => {
    try {
      const {
        companyId,
        companyName,
        studentId,
        interviewDate: rawInterviewDate,
        currentStatus = "Assigned",
        feedback = null,
        notes = null
      } = req.body;
      // ✅ validate required fields
      if (!companyId || !companyName || !studentId) {
        return res.status(400).json({
          success: false,
          message: "Company ID, Company Name, and Student ID are required fields"
        });
      }
      // ✅ normalize interview date
      let interviewDate = null;
      if (rawInterviewDate && rawInterviewDate !== "Invalid date") {
        const d = new Date(rawInterviewDate);
        if (!isNaN(d.getTime())) {
          interviewDate = d.toISOString().slice(0, 10);
        }
      }
      // ✅ duplicate check
      const existingMapping = await MappedStudent.findOne({
        where: { companyId, studentId }
      });
      if (existingMapping) {
        return res.status(409).json({
          success: false,
          message: "Student is already mapped to this company"
        });

      }
      // ✅ status history
      const statusHistory = [{
        status: currentStatus,
        feedback,
        timestamp: new Date(),
        previousStatus: null
      }];
      // ✅ create mapping
      const newMappedStudent = await MappedStudent.create({

        companyId,
        companyName,
        studentId,
        interviewDate,
        currentStatus,
        feedback,
        notes,
        statusHistory,
        lastStatusUpdate: new Date(),
        mappedByName: req.user.emp_name,
        mappedByContact: req.user.contact_num,

      });

      const [affectedRows] = await StudentCourse.increment('mappingCount', {
        where: { studentId }
      });
      console.log(`🔢 mappingCount increment affected rows: ${affectedRows}`);
      // ✅ RESPOND IMMEDIATELY (FAST)
      res.status(201).json({
        success: true,
        message: "Student successfully mapped to company",
        data: newMappedStudent
      });
      // ====================================================
      // 🔔 PUSH + EMAIL IN BACKGROUND (NO API DELAY)
      // ====================================================
      (async () => {
        try {
          // =====================
          // PUSH NOTIFICATION
          // =====================
          const tokens = await StudentDeviceToken.findAll({
            where: { studentId },
            attributes: ["token"]
          });
          const tokenList = tokens.map(t => t.token);
          console.log("TOKENS:", tokenList);
          if (tokenList.length > 0) {
            const response =
              await admin.messaging().sendEachForMulticast({
                tokens: tokenList,
                notification: {
                  title: "🎯 Interview Opportunity Assigned",
                  body:
                    `${companyName} has shortlisted you. Check your interview details now.`
                },
                data: {
                  companyId: String(companyId),
                  studentId: String(studentId),
                  type: "INTERVIEW_ASSIGNED"
                },
                webpush: {
                  notification: {
                    icon: "/images/logo.png"
                  },
                  fcmOptions: {
                    link: "https://pumotechnovationcrm.com/login"
                  }
                }
              });
            // remove invalid tokens
            for (let i = 0; i < response.responses.length; i++) {
              if (!response.responses[i].success) {
                await StudentDeviceToken.destroy({
                  where: { token: tokenList[i] }
                });
              }
            }
          }
          else {
            console.log("No tokens found");
          }
          // =====================
          // EMAIL
          // =====================
          const student = await StudentRegistration.findOne({
            where: { studentId },
            attributes: ["email_Id"]
          });
          if (student?.email_Id) {
            await sendMappingEmail(
              student.email_Id,
              studentId,
              companyName,
              interviewDate,
              newMappedStudent.mappedByName,
              newMappedStudent.mappedByContact
            );
          }
          else {
            console.log("No student email found");
          }
        }
        catch (err) {
          console.error("Background notification/email error:", err);
        }
      })();
    }
    catch (error) {

      console.error("Error mapping student:", error);

      return res.status(500).json({
        success: false,
        message: "Internal server error",
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
          message: "Mapping ID is required",
        });
      }

      const mappedStudent = await MappedStudent.findByPk(id);

      if (!mappedStudent) {
        return res.status(404).json({
          success: false,
          message: "Mapped student not found",
        });
      }

      // get student email
      const student = await StudentRegistration.findOne({
        where: { studentId: mappedStudent.studentId },
      });

      // send email BEFORE delete
      if (student?.email_Id) {
        await sendUnmappingEmail(
          student.email_Id,
          mappedStudent.studentId,
          mappedStudent.companyName,
          mappedStudent.mappedByName,
          mappedStudent.mappedByContact
        );
      }

      // delete mapping
      await mappedStudent.destroy();

      // ✅ Decrement mappingCount (floor at 0)
      await StudentCourse.decrement('mappingCount', {
        where: {
          studentId: mappedStudent.studentId,
          mappingCount: { [Op.gt]: 0 }   // prevent going below 0
        }
      });

      res.status(200).json({
        success: true,
        message: "Student successfully unmapped from company",
      });

    } catch (error) {
      console.error("Error unmapping student:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
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
      const { status, acknowledgementStatus, branch, studentName } = req.query;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: "Company ID is required"
        });
      }

      // 🔹 1) get placement to know required skills
      const placement = await Placement.findOne({
        where: { jobReqId: companyId }
      });

      const skillsToMatch = placement?.skillSet
        ? placement.skillSet
          .split(",")
          .map(s => s.trim().toLowerCase())
          .filter(Boolean)
        : [];

      // 🔹 2) get mapped students with filters
      const whereClause = { companyId };

      if (status) {
        whereClause.currentStatus = status;
      }

      if (acknowledgementStatus) {
        whereClause.acknowledgementStatus = acknowledgementStatus;
      }

      const mappedStudents = await MappedStudent.findAll({
        where: whereClause,
        order: [["createdAt", "DESC"]],
        attributes: [
          "id",
          "studentId",
          "companyId",
          "currentStatus",
          "interviewDate",
          "feedback",
          "mappedByName",
          "mappedByContact",
          "createdAt",

          // ✅ NEW FIELDS
          "acknowledgementStatus",
          "acknowledgementDate"
        ]
      });

      if (!mappedStudents.length) {
        return res.status(200).json({
          success: true,
          count: 0,
          data: []
        });
      }

      // 🔹 3) fetch StudentCourse fields
      const studentIds = mappedStudents.map(ms => ms.studentId);

      const students = await StudentCourse.findAll({
        where: { studentId: { [Op.in]: studentIds } },
        attributes: [
          "studentId",
          "studentName",
          "branch",
          "courseName",
          "desiredlocation",
          "ugDegree",
          "ugPassout",
          "pgDegree",
          "pgPassout",
          "knownSkill",
          "experience",
          "diplomaDepartment",
          "diplomaPassout",
          "ugDepartment",
          "pgDepartment",
          "id",
          "placementInterest",
          "staffRemarks",
          "ProgressStatus"
        ]
      });
      const studentRegistrations = await StudentRegistration.findAll({
        where: { studentId: { [Op.in]: studentIds } },
        attributes: ["studentId", "lastLogin"]
      });

      const loginMap = {};
      studentRegistrations.forEach(r => {
        loginMap[r.studentId] = r.lastLogin;
      });
      // 🔹 4) build lookup
      const studentMap = {};
      students.forEach(s => {
        studentMap[s.studentId] = s.toJSON();
      });

      // 🔹 5) merge + compute match score
      let enriched = mappedStudents.map(ms => {
        const s = studentMap[ms.studentId] || {};
        const lastLogin = loginMap[ms.studentId] || null;

        const studentSkills = s.knownSkill
          ? s.knownSkill
            .split(",")
            .map(x => x.trim().toLowerCase())
            .filter(Boolean)
          : [];

        const requiredSkills = skillsToMatch
          ? skillsToMatch.map(x => x.trim().toLowerCase()).filter(Boolean)
          : [];

        let matchCount = 0;
        const matchedSkills = [];

        // EXACT MATCH ONLY
        requiredSkills.forEach(reqSkill => {
          if (studentSkills.includes(reqSkill)) {
            matchedSkills.push(reqSkill);
            matchCount++;
          }
        });

        const matchScore =
          requiredSkills.length > 0
            ? Math.round((matchCount / requiredSkills.length) * 100)
            : 0;

        return {
          // mapping fields
          mappingId: ms.id,
          companyId: ms.companyId,
          currentStatus: ms.currentStatus,
          interviewDate: ms.interviewDate,
          feedback: ms.feedback,
          mappedByName: ms.mappedByName,
          mappedByContact: ms.mappedByContact,
          createdAt: ms.createdAt,

          // ✅ NEW FIELDS RETURNED
          acknowledgementStatus: ms.acknowledgementStatus,
          acknowledgementDate: ms.acknowledgementDate,

          // student fields
          ...s,
          lastLogin,

          // computed fields
          matchScore: Math.min(matchScore, 100),
          matchedSkills,
          totalRequiredSkills: skillsToMatch.length,
          totalMatchedSkills: matchCount
        };
      });
      // ✅ APPLY BRANCH FILTER HERE
      if (branch) {
        const branches = branch.split(",").map(b => b.trim().toLowerCase());

        enriched = enriched.filter(student =>
          student.branch &&
          branches.includes(student.branch.toLowerCase())
        );
      }
      if (studentName) {
        const search = studentName.trim().toLowerCase();

        enriched = enriched.filter(student =>
          student.studentName &&
          student.studentName.toLowerCase().includes(search)
        );
      }
      res.status(200).json({
        success: true,
        count: enriched.length,
        data: enriched
      });

    } catch (error) {
      console.error("Error fetching mapped students by company ID:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  },

  getMappedStudentsByCompanyIdExcel: async (req, res) => {
    try {
      const { companyId } = req.params;
      const {
        status,
        acknowledgementStatus,
        branch,
        studentName,
        placementInterest,
        fromDate,
        toDate
      } = req.query;
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
      if (acknowledgementStatus) {   // ✅ add this filter
        whereClause.acknowledgementStatus = acknowledgementStatus;
      }


      const mappedStudents = await MappedStudent.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'studentId', 'currentStatus', 'interviewDate', 'companyId', 'feedback', 'mappedByName',
          'mappedByContact', 'createdAt', 'acknowledgementStatus', 'acknowledgementFeedback', 'acknowledgementDate']
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
          "pendingFees4",
          "lastLogin"
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
          mappedByName: mappingInfo.mappedByName,
          mappedByContact: mappingInfo.mappedByContact,
          mappedDate: mappingInfo.createdAt,
          acknowledgementStatus: mappingInfo.acknowledgementStatus,
          acknowledgementFeedback: mappingInfo.acknowledgementFeedback,
          acknowledgementDate: mappingInfo.acknowledgementDate,
          matchScore,
          matchedSkills: matchedSkills.join(', ')
        };
      });

      // Re-sort after merging
      enrichedData.sort(customExcelSort);

      let finalData = enrichedData;

      if (branch) {
        const branches = branch.split(",").map(b => b.trim().toLowerCase());

        finalData = finalData.filter(student =>
          student.branch &&
          branches.includes(student.branch.toLowerCase())
        );
      }
      if (placementInterest) {
        const interests = placementInterest
          .split(",")
          .map(p => p.trim());

        finalData = finalData.filter(student =>
          student.placementInterest &&
          interests.includes(student.placementInterest)
        );
      }
      if (studentName) {
        const search = studentName.trim().toLowerCase();

        finalData = finalData.filter(student =>
          student.studentName &&
          student.studentName.toLowerCase().includes(search)
        );
      }
      if (fromDate) {
        const startDate = new Date(fromDate + ":00+05:30");

        finalData = finalData.filter(student =>
          new Date(student.mappedDate) >= startDate
        );
      }

      if (toDate) {
        const endDate = new Date(toDate + ":59+05:30");

        finalData = finalData.filter(student =>
          new Date(student.mappedDate) <= endDate
        );
      }
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
        "pgPercentage",
        "mappedByName",
        "mappedByContact",
        "mappedDate",
        "acknowledgementStatus",
        "acknowledgementFeedback",
        "acknowledgementDate",
        "lastLogin",
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
        interviewDate: "Interview Date",
        mappedByName: "Mapped By Name",
        mappedByContact: "Mapped By Contact",
        mappedDate: "Mapped Date",
        acknowledgementStatus: "Acknowledgement Status",
        acknowledgementFeedback: "Acknowledgement Feedback",
        acknowledgementDate: "Acknowledgement Date",

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
      finalData.forEach(row => {
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
          }
          else if (col === "mappedDate") {
            rowData[col] = row[col]
              ? new Date(row[col]).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",   // ✅ IMPORTANT
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true               // ✅ AM/PM format
              })
              : "";
          }
          else if (col === "lastLogin") {
            rowData[col] = row[col]
              ? new Date(row[col]).toLocaleString("en-IN", { hour12: true })
              : "";
          }
          else {
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

      const FEEDBACK_REQUIRED = [
        'Cancelled',
        'Not Selected',
        'Rejected By Student',
        'Rejected the Offer'
      ];

      if (FEEDBACK_REQUIRED.includes(currentStatus) && !feedback) {
        return res.status(400).json({
          success: false,
          message: 'Feedback is required for this status'
        });
      }

      await mappedStudent.update({
        currentStatus,
        feedback: feedback ?? null,
        notes: notes ?? mappedStudent.notes
      });

      res.json({
        success: true,
        message: 'Status updated successfully',
        data: mappedStudent
      });

      // 🔔 EMAIL IN BACKGROUND
      (async () => {
        try {
          const student = await StudentRegistration.findOne({
            where: { studentId: mappedStudent.studentId },
            attributes: ['email_Id']
          });
          if (student?.email_Id) {
            await sendStatusUpdateEmail(
              student.email_Id,
              mappedStudent.studentId,
              mappedStudent.companyName,
              currentStatus,
              feedback || null
            );
          }
        } catch (err) {
          console.error('Background email error (updateStatus):', err);
        }
      })();

    } catch (error) {
      console.error('Error updating status:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  bulkUpdateStatus: async (req, res) => {
    try {
      const { mappingIds, currentStatus, feedback } = req.body;

      if (!mappingIds || !Array.isArray(mappingIds) || mappingIds.length === 0) {
        return res.status(400).json({ success: false, message: 'mappingIds array is required' });
      }
      if (!currentStatus) {
        return res.status(400).json({ success: false, message: 'currentStatus is required' });
      }

      const FEEDBACK_REQUIRED = ['Cancelled', 'Not Selected', 'Rejected By Student', 'Rejected the Offer'];

      if (FEEDBACK_REQUIRED.includes(currentStatus) && !feedback?.trim()) {
        return res.status(400).json({ success: false, message: 'Feedback is required for this status' });
      }

      // ✅ Fetch BEFORE update so studentId + companyName are available for emails
      const mappings = await MappedStudent.findAll({
        where: { id: mappingIds },
        attributes: ['id', 'studentId', 'companyName']
      });

      await MappedStudent.update(
        {
          currentStatus,
          feedback: feedback?.trim() || null
        },
        { where: { id: mappingIds } }
      );

      res.json({
        success: true,
        message: `Status updated for ${mappingIds.length} student(s)`,
        updatedCount: mappingIds.length
      });

      // 🔔 EMAILS IN BACKGROUND
      (async () => {
        try {
          const studentIds = mappings.map(m => m.studentId);
          const students = await StudentRegistration.findAll({
            where: { studentId: studentIds },
            attributes: ['studentId', 'email_Id']
          });

          const emailMap = {};
          students.forEach(s => { emailMap[s.studentId] = s.email_Id; });

          await Promise.allSettled(
            mappings.map(mapping => {
              const email = emailMap[mapping.studentId];
              if (!email) return Promise.resolve();
              return sendStatusUpdateEmail(
                email, mapping.studentId, mapping.companyName,
                currentStatus, feedback?.trim() || null
              );
            })
          );
        } catch (err) {
          console.error('Background email error (bulkUpdateStatus):', err);
        }
      })();

    } catch (error) {
      console.error('Bulk status update error:', error);
      res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
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
          acknowledgementDate: mapping.acknowledgementDate,
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
  // STUDENT ACKNOWLEDGEMENT
  acknowledgeMapping: async (req, res) => {
    try {

      const { mappingId } = req.params;

      const {
        acknowledgementStatus,   // Accepted / Rejected
        acknowledgementFeedback
      } = req.body;

      const studentId = req.student.studentId;

      if (!mappingId)
        return res.status(400).json({
          success: false,
          message: "Mapping ID required"
        });

      if (!['Accepted', 'Rejected'].includes(acknowledgementStatus))
        return res.status(400).json({
          success: false,
          message: "Invalid acknowledgement status"
        });

      if (
        acknowledgementStatus === "Rejected" &&
        !acknowledgementFeedback
      ) {
        return res.status(400).json({
          success: false,
          message: "Feedback is mandatory when rejecting"
        });
      }

      const mapping = await MappedStudent.findOne({
        where: {
          id: mappingId,
          studentId
        }
      });

      if (!mapping)
        return res.status(404).json({
          success: false,
          message: "Mapping not found"
        });

      let newAcknowledgementStatus = acknowledgementStatus;
      let newCurrentStatus = mapping.currentStatus;

      // ===== CASE 1: Mapping acknowledgement =====
      if (mapping.currentStatus === "Assigned") {

        if (acknowledgementStatus === "Accepted") {
          newAcknowledgementStatus = "Accepted";
          newCurrentStatus = "Acknowledged";
        } else {
          newAcknowledgementStatus = "Rejected";
          newCurrentStatus = "Rejected By Student";
        }

      }

      // ===== CASE 2: Interview confirmation =====
      else if (mapping.currentStatus === "Interview Scheduled") {

        if (acknowledgementStatus === "Accepted") {
          newAcknowledgementStatus = "Interview Accepted";
          newCurrentStatus = "Interview Scheduled"; // keep same
        } else {
          newAcknowledgementStatus = "Rejected";
          newCurrentStatus = "Rejected By Student";
        }

      }

      await mapping.update({

        acknowledgementStatus: newAcknowledgementStatus,

        acknowledgementFeedback:
          acknowledgementStatus === "Rejected"
            ? acknowledgementFeedback
            : null,

        acknowledgementDate: new Date(),

        currentStatus: newCurrentStatus,

        feedback:
          acknowledgementStatus === "Rejected"
            ? acknowledgementFeedback
            : mapping.feedback

      });

      res.json({
        success: true,
        message: `${acknowledgementStatus} successfully`,
        data: mapping
      });

    }
    catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message: error.message
      });

    }
  },

  getStudentCompanyFullDetails: async (req, res) => {
    try {

      const { mappingId } = req.params;

      const studentId = req.student?.studentId; // exists for student
      const staffUser = req.user;               // exists for staff

      let whereClause = { id: mappingId };

      // ✅ If student → restrict to their own mapping
      if (studentId) {
        whereClause.studentId = studentId;
      }

      const mapping = await MappedStudent.findOne({
        where: whereClause
      });

      if (!mapping) {
        return res.status(404).json({
          success: false,
          message: "Mapping not found or access denied"
        });
      }

      const placement = await Placement.findOne({
        where: {
          jobReqId: mapping.companyId
        }
      });

      res.json({
        success: true,
        data: {
          mappingDetails: {
            id: mapping.id,
            studentId: mapping.studentId,
            companyName: mapping.companyName,
            interviewDate: mapping.interviewDate,
            currentStatus: mapping.currentStatus,
            feedback: mapping.feedback,
            acknowledgementStatus: mapping.acknowledgementStatus,
            acknowledgementDate: mapping.acknowledgementDate,
            acknowledgementFeedback: mapping.acknowledgementFeedback,
            mappedDate: mapping.createdAt
          },
          placementDetails: placement
        }
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        message: error.message
      });

    }
  },

  getStudentNotifications: async (req, res) => {
    try {

      const studentId = req.student.studentId;

      // 1️⃣ Get all OPEN job requests
      const openPlacements = await Placement.findAll({
        where: { jobReqStatus: "Open" },
        attributes: ["jobReqId"]
      });

      const openJobIds = openPlacements.map(p => p.jobReqId);

      // 2️⃣ Get notifications
      const data = await MappedStudent.findAll({
        where: {
          studentId,
          companyId: openJobIds,
          [Op.or]: [
            { acknowledgementStatus: "Pending" }, // mapping acknowledgement
            {
              currentStatus: "Interview Scheduled",
              acknowledgementStatus: {
                [Op.not]: "Interview Accepted"
              }
            }
          ]
        },
        order: [["createdAt", "DESC"]],
        attributes: [
          "id",
          "companyName",
          "createdAt",
          "acknowledgementStatus",
          "currentStatus"
        ]
      });

      res.json({
        success: true,
        data
      });

    } catch (error) {

      console.error("Error fetching notifications:", error);

      res.status(500).json({
        success: false,
        message: "Server error"
      });

    }
  },

};

module.exports = mappedStudentController;