const path = require('path');
const fs = require('fs');
const mime = require("mime-types");
const { Op, where, fn, col } = require("sequelize");
const archiver = require('archiver');
const Student = require('../models/studenReg');
const StudentCourse = require('../models/StudentCourse');
const StudentRegistration = require('../models/studenReg');
const Placement = require('../models/Placement');
const MappedStudent = require('../models/Mappedstudents');
const logger = require("../logger");
const buildStudentFilters = require("../utils/studentFilters");



const getFullFilePath = (resumePath) => {
  const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");

  if (!resumePath) return null;

  // ✅ Handle "/uploads/xyz.pdf"
  if (resumePath.startsWith("/uploads/")) {
    const relativePath = resumePath.replace("/uploads/", "");
    return path.join(uploadsDir, relativePath);
  }

  // ✅ Handle relative paths like "resumes/xyz.pdf"
  if (!path.isAbsolute(resumePath)) {
    return path.join(uploadsDir, resumePath);
  }

  // ✅ Already absolute → return as-is
  return resumePath;
};
const downloadOfferLetter = async (req, res) => {
  try {
    const { studentId } = req.params;

    // ✅ Validate input
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "studentId is required"
      });
    }

    // ✅ Fetch offerLetterPath from StudentRegistrations
    const student = await StudentRegistration.findOne({
      where: { studentId },
      attributes: ["offerLetterPath"]
    });

    // ✅ No offer letter uploaded
    if (!student || !student.offerLetterPath) {
      return res.status(404).json({
        success: false,
        message: "No offer letter found for this student"
      });
    }

    // ✅ Build actual file path
    const filePath = getFullFilePath(student.offerLetterPath);

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "Offer letter file not found on server"
      });
    }

    // ✅ Get file extension from the ACTUAL file path (not DB path)
    const fileExt = path.extname(filePath);
    const fileName = `OfferLetter_${studentId}${fileExt}`;

    // ✅ Determine correct MIME type
    const mimeType = mime.lookup(filePath);

    if (!mimeType) {
      console.error("Could not determine MIME type for:", filePath);
      return res.status(500).json({
        success: false,
        message: "Could not determine file type"
      });
    }

    const safeFileName = fileName.trim();

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(safeFileName)}`
    );

    // ✅ Set content length for better download experience
    const stat = fs.statSync(filePath);
    res.setHeader("Content-Length", stat.size);

    // ✅ Stream file
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    // ✅ Handle stream errors
    stream.on("error", (err) => {
      console.error("Offer letter stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Error downloading offer letter"
        });
      }
    });

  } catch (error) {
    console.error("Download offer letter error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  }
};
// Individual resume download
const downloadResume = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Find student and get resume path
    const student = await Student.findOne({
      where: { studentId },
      attributes: ["resumePath", "name", "studentId"],
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (!student.resumePath) {
      return res.status(200).json({
        success: true,
        hasResume: false,
        message: "No resume found for this student",
      });
    }

    // Construct full file path
    const filePath = getFullFilePath(student.resumePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "Resume file not found on server",
      });
    }

    // Get file extension for proper filename
    const fileExt = path.extname(filePath);
    const fileName = `${student.name}_${student.studentId}_Resume${fileExt}`;

    // Set headers for file download
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "application/octet-stream");

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("error", (error) => {
      console.error("File stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Error downloading file",
        });
      }
    });
  } catch (error) {
    console.error("Download resume error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
// Bulk resume download
const downloadBulkResumes = async (req, res) => {
  try {
    const { studentIds } = req.body; // Array of student IDs

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of student IDs',
      });
    }

    // 🔍 Fetch students with resume paths
    const students = await Student.findAll({
      where: {
        studentId: studentIds,
        resumePath: { [Op.ne]: null },
      },
      attributes: ['studentId', 'resumePath', 'name', 'department', 'adminbranch'],
    });

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No resumes found for the provided student IDs',
      });
    }

    // 🗂️ Zip setup
    const zipFileName = `Selected_Resumes_${new Date().toISOString().split('T')[0]}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (error) => {
      console.error('Archive error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error creating zip file',
        });
      }
    });

    archive.pipe(res);

    const addedFiles = [];
    const notFoundFiles = [];

    // 🧠 Add student resumes
    for (const student of students) {
      const filePath = getFullFilePath(student.resumePath);


      if (fs.existsSync(filePath)) {
        const fileExt = path.extname(filePath);

        // 🧩 Safe naming with fallback + cleanup
        const safeName = (student.name || 'student').replace(/[^\w\s]/gi, '_');
        const safeDept = (student.department || 'Dept').replace(/[^\w\s]/gi, '_');
        const safeBranch = (student.adminbranch || 'Branch').replace(/[^\w\s]/gi, '_');

        // 📄 Final filename (same as single resume)
        const fileName = `${safeName}_${safeDept}_${safeBranch}_resume${fileExt}`;

        archive.file(filePath, { name: fileName });

        addedFiles.push({
          studentId: student.studentId,
          name: student.name,
          fileName,
        });
      } else {
        notFoundFiles.push({
          studentId: student.studentId,
          name: student.name,
        });
      }
    }

    // 📝 Summary file inside ZIP
    const summaryContent = `Resume Download Summary
Generated on: ${new Date().toISOString()}

✅ Successfully Added Files (${addedFiles.length}):
${addedFiles.map(f => `- ${f.name} (${f.studentId}) -> ${f.fileName}`).join('\n')}

${notFoundFiles.length > 0
        ? `❌ Files Not Found (${notFoundFiles.length}):
${notFoundFiles.map(f => `- ${f.name} (${f.studentId})`).join('\n')}`
        : 'All requested files were found and added.'}
`;

    archive.append(summaryContent, { name: 'download_summary.txt' });

    // 📦 Finalize
    archive.finalize();

  } catch (error) {
    console.error('Bulk download error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
};
// Download all resumes (for admin use)
const downloadAllResumes = async (req, res) => {
  try {
    const {
      type = "placementEligible",
      resumeStatus,
      searchField,
      searchValue
    } = req.query;

    const user = req.user;

    if (!user || !user.emp_name) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // ================== ✅ BASE FILTERS ==================
    const baseFilters = buildStudentFilters(req.query);

    const whereClause = {
      [Op.and]: [baseFilters]
    };

    // ================== ✅ TYPE LOGIC ==================

    // 🔹 Placement Eligible
    if (type === "placementEligible") {
      whereClause[Op.and].push({
        readyForPlacement: "Yes"
      });
      whereClause[Op.and].push({
        placementStatus: {
          [Op.in]: [
            "Awaiting for placement",
            "Placed but not accepted the Offer"
          ]
        }
      });
    }

    // 🔹 Mentor
    if (type === "mentor") {
      whereClause[Op.and].push({
        mentor: user.emp_name,
        mentorid: String(user.emp_id)
      });

      whereClause[Op.and].push({
        placementStatus: {
          [Op.in]: [
            "Awaiting for placement",
            "Placed but not accepted the Offer"
          ]
        }
      });
    }
    if (type === "getAll") {
      whereClause[Op.and].push({
        [Op.or]: [
          { staffName1: user.emp_name },
          { staffName2: user.emp_name },
          { staffName3: user.emp_name },

          { staffId1: String(user.emp_id) },
          { staffId2: String(user.emp_id) },
          { staffId3: String(user.emp_id) }
        ]
      });

      whereClause[Op.and].push({
        placementStatus: {
          [Op.in]: [
            "Awaiting for placement",
            "Placed but not accepted the Offer"
          ]
        }
      });
    }

    // 🔹 getAll → no extra condition

    console.log("✅ TYPE:", type);
    console.log("✅ WHERE:", JSON.stringify(whereClause, null, 2));

    // ================== ✅ FETCH STUDENT COURSE ==================
    let studentCourseResults = await StudentCourse.findAll({
      where: whereClause
    });

    if (!studentCourseResults.length) {
      return res.status(404).json({
        success: false,
        message: "No students found"
      });
    }

    const studentIds = studentCourseResults.map(s => s.studentId);

    // ================== ✅ REGISTRATION FILTER ==================
    const registrationWhereClause = {
      studentId: { [Op.in]: studentIds }
    };

    // 🔹 Placement-only fees validation
    if (type === "placementEligible") {
      registrationWhereClause[Op.and] = [
        { pendingFees: { [Op.or]: [null, 0] } },
        { pendingFees2: { [Op.or]: [null, 0] } },
        { pendingFees3: { [Op.or]: [null, 0] } },
        { pendingFees4: { [Op.or]: [null, 0] } }
      ];
    }

    // 🔹 Resume filter
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

    // 🔹 Education search
    if (searchField === "educationCourse" && searchValue) {
      registrationWhereClause.educationCourse = {
        [Op.like]: `%${searchValue}%`
      };
    }

    const registrationData = await StudentRegistration.findAll({
      where: registrationWhereClause,
      attributes: [
        "studentId",
        "resumePath",
        "name",
        "department",
        "adminbranch"
      ]
    });

    const validIds = new Set(registrationData.map(r => r.studentId));

    let filteredResults = studentCourseResults;

    if (resumeStatus || type === "placementEligible") {
      filteredResults = studentCourseResults.filter(s =>
        validIds.has(s.studentId)
      );
    }

    if (!filteredResults.length) {
      return res.status(404).json({
        success: false,
        message: "No eligible students found"
      });
    }

    // ================== ✅ ZIP ==================
    const zipFileName = `Filtered_Resumes_${type}_${new Date().toISOString().split("T")[0]}.zip`;

    res.setHeader("Content-Disposition", `attachment; filename="${zipFileName}"`);
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", err => {
      console.error("Archive error:", err);
      if (!res.headersSent) {
        return res.status(500).json({ success: false, message: "ZIP failed" });
      }
    });

    archive.pipe(res);

    const addedFiles = [];
    const notFoundFiles = [];

    for (const student of registrationData) {
      if (!student.resumePath) continue;

      const filePath = getFullFilePath(student.resumePath);

      if (fs.existsSync(filePath)) {
        const fileExt = path.extname(filePath);

        const safeName = (student.name || "student").replace(/[^\w\s]/gi, "_");
        const safeDept = (student.department || "Dept").replace(/[^\w\s]/gi, "_");
        const safeBranch = (student.adminbranch || "Branch").replace(/[^\w\s]/gi, "_");

        const fileName = `${safeName}_${safeDept}_${safeBranch}_resume${fileExt}`;

        archive.file(filePath, { name: fileName });

        addedFiles.push(fileName);
      } else {
        notFoundFiles.push(student.studentId);
      }
    }

    // ================== ✅ SUMMARY ==================
    const summary = `
Download Type: ${type}
Generated: ${new Date().toISOString()}

Total Students: ${filteredResults.length}
Files Added: ${addedFiles.length}
Missing Files: ${notFoundFiles.length}
`;

    archive.append(summary, { name: "summary.txt" });

    await archive.finalize();

  } catch (error) {
    console.error("downloadAllResumes error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  }
};

const downloadMappedStudentsResumes = async (req, res) => {
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

    logger.info("Incoming request to download mapped students resumes", {
      companyId,
      status
    });

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

    const companyName = placement.companyName || companyId;

    // 2) Get mapped students
    const whereClause = { companyId };
    if (status) whereClause.currentStatus = status;
    if (acknowledgementStatus) {   // ✅ add this
      whereClause.acknowledgementStatus = acknowledgementStatus;
    }
    const mappedStudents = await MappedStudent.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'studentId', 'currentStatus', 'interviewDate', 'companyId', 'feedback', 'createdAt']
    });

    if (!mappedStudents.length) {
      return res.status(404).json({
        success: false,
        message: "No mapped students found"
      });
    }

    const studentIds = mappedStudents.map(ms => ms.studentId);

    // 3) Fetch StudentCourse data
    const studentCourseResults = await StudentCourse.findAll({
      where: { studentId: { [Op.in]: studentIds } },
      attributes: [
        'studentId',
        'studentName',
        'branch',
        'courseName',
        'ProgressStatus',
        'Department',
        'placementInterest',
      ]
    });

    // 4) Custom sort
    const customSort = (a, b) => {
      const branchCompare = (a.branch || "").localeCompare(b.branch || "");
      if (branchCompare !== 0) return branchCompare;

      const statusA = a.ProgressStatus || "";
      const statusB = b.ProgressStatus || "";

      if (statusA === "Course Completed" && statusB !== "Course Completed") return -1;
      if (statusA !== "Course Completed" && statusB === "Course Completed") return 1;

      return statusA.localeCompare(statusB);
    };

    studentCourseResults.sort(customSort);

    // 5) Fetch registration data with resume paths
    const registrationWhereClause = {
      studentId: { [Op.in]: studentIds },
      [Op.and]: [
        { pendingFees: { [Op.or]: [null, 0] } },
        { pendingFees2: { [Op.or]: [null, 0] } },
        { pendingFees3: { [Op.or]: [null, 0] } },
        { pendingFees4: { [Op.or]: [null, 0] } },
      ],
      resumePath: {
        [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }]
      }
    };

    const registrationData = await StudentRegistration.findAll({
      where: registrationWhereClause,
      attributes: [
        "studentId",
        "resumePath",
        "name",
        "department",
        "adminbranch"
      ]
    });

    const eligibleIds = new Set(registrationData.map(r => r.studentId));

    let filteredStudentCourseResults = studentCourseResults.filter(row =>
      eligibleIds.has(row.studentId)
    );
    const mappedStudentMap = {};
    mappedStudents.forEach(ms => {
      mappedStudentMap[ms.studentId] = ms.toJSON();
    });
    filteredStudentCourseResults.sort(customSort);
    if (branch) {
      const branches = branch.split(",").map(b => b.trim().toLowerCase());
      filteredStudentCourseResults = filteredStudentCourseResults.filter(s =>
        s.branch && branches.includes(s.branch.trim().toLowerCase())
      );
    }
    if (placementInterest) {
      const interests = placementInterest
        .split(",")
        .map(p => p.trim());

      filteredStudentCourseResults =
        filteredStudentCourseResults.filter(student =>
          student.placementInterest &&
          interests.includes(student.placementInterest)
        );
    }
    if (studentName) {
      const search = studentName.trim().toLowerCase();

      filteredStudentCourseResults =
        filteredStudentCourseResults.filter(student =>
          student.studentName &&
          student.studentName.toLowerCase().includes(search)
        );
    }
    // From Date Filter
    if (fromDate) {
      const startDate = new Date(fromDate + ":00+05:30");

      filteredStudentCourseResults =
        filteredStudentCourseResults.filter(student => {
          const mappingInfo =
            mappedStudentMap[student.studentId] || {};

          return (
            mappingInfo.createdAt &&
            new Date(mappingInfo.createdAt) >= startDate
          );
        });
    }

    // To Date Filter
    if (toDate) {
      const endDate = new Date(toDate + ":59+05:30");

      filteredStudentCourseResults =
        filteredStudentCourseResults.filter(student => {
          const mappingInfo =
            mappedStudentMap[student.studentId] || {};

          return (
            mappingInfo.createdAt &&
            new Date(mappingInfo.createdAt) <= endDate
          );
        });
    }
    if (!filteredStudentCourseResults.length) {
      return res.status(404).json({
        success: false,
        message: "No eligible students found after fee validation"
      });
    }

    // 6) Get students with resumes
    const filteredStudentIds = new Set(
      filteredStudentCourseResults.map(s => s.studentId)
    );

    const studentsWithResume = registrationData.filter(
      r =>
        r.resumePath &&
        filteredStudentIds.has(r.studentId)
    );
    if (!studentsWithResume.length) {
      return res.status(404).json({
        success: false,
        message: "No resumes found for mapped students"
      });
    }

    // 7) Build lookup maps
    const studentCourseMap = {};
    studentCourseResults.forEach(s => {
      studentCourseMap[s.studentId] = s.toJSON();
    });

    // 8) ZIP generation
    const sanitizedCompanyName = companyName.replace(/[^\w\s]/gi, "_");
    const zipFileName = `${sanitizedCompanyName}_Mapped_Resumes_${new Date().toISOString().split("T")[0]}.zip`;

    res.setHeader("Content-Disposition", `attachment; filename="${zipFileName}"`);
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", err => {
      logger.error("Archive error", err);
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message: "ZIP creation failed"
        });
      }
    });

    archive.pipe(res);

    const addedFiles = [];
    const notFoundFiles = [];

    for (const student of studentsWithResume) {
      const filePath = getFullFilePath(student.resumePath);

      if (fs.existsSync(filePath)) {
        const fileExt = path.extname(filePath);

        const safeName = (student.name || "student").replace(/[^\w\s]/gi, "_");

        // Get mapping status
        const mappingInfo = mappedStudentMap[student.studentId] || {};

        const filename = `${safeName}_resume${fileExt}`;

        archive.file(filePath, { name: filename });

        addedFiles.push({
          studentId: student.studentId,
          name: student.name,
          filename,
          status: mappingInfo.currentStatus,
          interviewDate: mappingInfo.interviewDate
        });
      } else {
        notFoundFiles.push({
          studentId: student.studentId,
          name: student.name
        });
      }
    }

    // 9) Summary file
    const safeAdded = Array.isArray(addedFiles) ? addedFiles : [];
    const safeMissing = Array.isArray(notFoundFiles) ? notFoundFiles : [];

    const summary = `
Mapped Students Resume Summary
Company: ${companyName}
Job Requirement ID: ${companyId}
Generated: ${new Date().toISOString()}
${status ? `Filter: ${status}` : 'Filter: All Statuses'}

Total Mapped Students: ${mappedStudents.length}
Students After Fee Validation: ${filteredStudentCourseResults.length}
Resumes Added: ${safeAdded.length}
Missing Files: ${safeMissing.length}

Added Files:
${safeAdded.map(f => `- ${f.name} (${f.studentId}) | Status: ${f.status || 'N/A'} | File: ${f.filename}`).join("\n")}

${safeMissing.length ? "Missing Files:\n" + safeMissing.map(f => `- ${f.name} (${f.studentId})`).join("\n") : "All files found."}

---
Interview Status Breakdown:
${getStatusBreakdown(safeAdded)}
`;

    archive.append(summary, { name: "summary.txt" });

    await archive.finalize();

    logger.info("Successfully created ZIP archive", {
      companyId,
      totalFiles: safeAdded.length,
      missingFiles: safeMissing.length
    });

  } catch (error) {
    logger.error("downloadMappedStudentsResumes failed", {
      message: error.message,
      stack: error.stack,
      companyId: req.params.companyId,
      query: req.query
    });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  }
};
// Helper function for status breakdown in summary
function getStatusBreakdown(addedFiles) {
  const statusCount = {};

  addedFiles.forEach(file => {
    const status = file.status || 'Unknown';
    statusCount[status] = (statusCount[status] || 0) + 1;
  });

  return Object.entries(statusCount)
    .map(([status, count]) => `  ${status}: ${count}`)
    .join("\n") || "  No status data available";
};
// Updated unified controller for resume downloads
const downloadResumes = async (req, res) => {
  try {
    const { studentIds } = req.body; // Array of student IDs for bulk download
    const {
      // Filters for filtered download
      courseTypes,
      courseNames,
      branches,
      companyLocations,
      experiences,
      searchField,
      searchValue
    } = req.query;

    let students = [];
    let downloadType = '';

    // Determine download type based on request
    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      // Bulk download - specific student IDs
      downloadType = 'bulk';
      students = await Student.findAll({
        where: {
          studentId: studentIds,
          resumePath: { [require('sequelize').Op.ne]: null }
        },
        attributes: ['studentId', 'resumePath', 'name']
      });
    } else {
      // Filtered download - based on filters
      downloadType = 'filtered';

      // Build where clause for filtered download
      const whereClause = {
        placementneeded: 'Yes',
        ProgressStatus: 'Course Completed',
        resumePath: { [require('sequelize').Op.ne]: null }
      };

      // Apply filters
      if (courseTypes) {
        const courseTypeArray = courseTypes.split(',').map(type => type.trim());
        whereClause.courseType = { [require('sequelize').Op.in]: courseTypeArray };
      }

      if (courseNames) {
        const courseNameArray = courseNames.split(',').map(name => name.trim());
        whereClause.courseName = { [require('sequelize').Op.in]: courseNameArray };
      }

      if (branches) {
        const branchArray = branches.split(',').map(branch => branch.trim());
        whereClause.branch = { [require('sequelize').Op.in]: branchArray };
      }

      if (companyLocations) {
        const locationArray = companyLocations.split(',').map(location => location.trim());
        if (locationArray.length > 0) {
          const locationConditions = [
            { desiredlocation: { [require('sequelize').Op.like]: '%No Constraint%' } },
            ...locationArray.map(location => ({
              desiredlocation: { [require('sequelize').Op.like]: `%${location}%` }
            }))
          ];
          whereClause[require('sequelize').Op.or] = locationConditions;
        }
      }

      if (experiences) {
        const experienceArray = experiences.split(',').map(exp => exp.trim());
        whereClause.experience = { [require('sequelize').Op.in]: experienceArray };
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
      // Search functionality
      if (searchField && searchValue) {
        whereClause[searchField] = { [require('sequelize').Op.like]: `%${searchValue}%` };
      }

      students = await Student.findAll({
        where: whereClause,
        attributes: ['studentId', 'resumePath', 'name']
      });
    }

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: downloadType === 'bulk'
          ? 'No resumes found for the selected students'
          : 'No resumes found matching the current filters'
      });
    }

    // Set response headers for zip download
    const zipFileName = downloadType === 'bulk'
      ? `Selected_Resumes_${Date.now()}.zip`
      : `Filtered_Resumes_${Date.now()}.zip`;

    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
    res.setHeader('Content-Type', 'application/zip');

    // Create zip archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Handle archive errors
    archive.on('error', (error) => {
      console.error('Archive error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error creating zip file'
        });
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add files to archive
    const addedFiles = [];
    const notFoundFiles = [];

    for (const student of students) {
      const filePath = getFullFilePath(student.resumePath);

      if (fs.existsSync(filePath)) {
        const fileExt = path.extname(filePath);
        const fileName = `${student.studentId}_${student.name}_Resume${fileExt}`;

        archive.file(filePath, { name: fileName });
        addedFiles.push({
          studentId: student.studentId,
          name: student.name,
          fileName: fileName
        });
      } else {
        notFoundFiles.push({
          studentId: student.studentId,
          name: student.name
        });
      }
    }

    // Add a summary file to the zip
    const summaryContent = `Resume Download Summary
Generated on: ${new Date().toISOString()}
Download Type: ${downloadType === 'bulk' ? 'Selected Students' : 'Filtered Results'}

Successfully Added Files (${addedFiles.length}):
${addedFiles.map(f => `- ${f.name} (${f.studentId}) -> ${f.fileName}`).join('\n')}

${notFoundFiles.length > 0 ? `Files Not Found (${notFoundFiles.length}):
${notFoundFiles.map(f => `- ${f.name} (${f.studentId})`).join('\n')}` : 'All requested files were found and added.'}

${downloadType === 'filtered' ? `Applied Filters:
${courseTypes ? `- Course Types: ${courseTypes}` : ''}
${courseNames ? `- Course Names: ${courseNames}` : ''}
${branches ? `- Branches: ${branches}` : ''}
${companyLocations ? `- Company Locations: ${companyLocations}` : ''}
${experiences ? `- Experience Levels: ${experiences}` : ''}
${searchField && searchValue ? `- Search: ${searchField} contains "${searchValue}"` : ''}` : ''}
`;

    archive.append(summaryContent, { name: 'download_summary.txt' });

    // Finalize the archive
    archive.finalize();

  } catch (error) {
    console.error('Resume download error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
};
// Individual offer letter download (by studentId only)


module.exports = {
  downloadResume,
  downloadBulkResumes,
  downloadAllResumes,
  downloadResumes,
  downloadOfferLetter,
  downloadMappedStudentsResumes
};