const Placement = require('../models/Placement');
const MappedStudent = require('../models/Mappedstudents');
const JobRequirementView = require('../models/JobRequirementView');
const StudentCourse = require("../models/StudentCourse");
const { Sequelize, Op } = require('sequelize');
const Employee = require('../models/Employee');
const { sendPlacementNotification, sendPlacementUpdateNotification } = require('../utils/sendPlacementNotification');
const { sendPlacementUpdateStudentEmail } = require("../utils/sendPlacementUpdateStudentEmail");
const { sendPlacementClosureSummaryEmail } = require("../utils/sendPlacementClosureSummaryEmail");
const { sendPlacementClosureStudentEmail } = require("../utils/sendPlacementClosureStudentEmail");
const { sendPlacementEscalationMail } = require("../utils/sendPlacementEscalationMail");

const ExcelJS = require("exceljs");
const sequelize = require("../config/database");

exports.updatePlacement = async (req, res) => {
  try {
    // Get jobReqId from URL params
    const { jobReqId } = req.params;

    // Extract user information from the authenticated request
    const { emp_id, emp_name, role } = req.user;

    const {
      jobReqStatus,
      jobTitle,
      jobDescription,
      companyName,
      jobLocation,
      department,
      skillSet,
      additionalSkills,
      qualification,
      passedOutYear,
      experienceRequired,
      salary,
      bond,
      bondDetails,
      interviewType,
      directApplyLink,
      modeOfInterview,
      numberOfOpenings,
      numberOfRounds,
      interviewDate,
      interviewTime,
      interviewLocation,
      venue,
      additionalDetails,
      companyHRName,
      companyHRContact,
      companyHREmail,
      allowedBranches,
      feedbackForClosure,
      totalSelectionCount,
      feedbackForFreeze,
      gender,
      mappedStudentFeedback,
    } = req.body;

    // Check if placement record exists using jobReqId
    const existingPlacement = await Placement.findOne({
      where: { jobReqId }
    });

    if (!existingPlacement) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Job requirement with ID ${jobReqId} not found`
      });
    }

    // Authorization: ONLY the person who created the record can update
    const isOwner = existingPlacement.createdBy === emp_name;

    if (!isOwner) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to update this job requirement. Only the original creator can make changes.'
      });
    }
    const isStatusChangedToClosedOrCancelled =
      jobReqStatus &&
      (jobReqStatus === 'Cancelled' || jobReqStatus === 'Closed') &&
      existingPlacement.jobReqStatus !== jobReqStatus;

    // Validate feedback when closing/cancelling
    if (isStatusChangedToClosedOrCancelled && !req.body.feedbackForClosure) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Feedback is required when changing status to Closed or Cancelled'
      });
    }
    const isStatusChangedToCancelled =
      jobReqStatus === "Cancelled" &&
      existingPlacement.jobReqStatus !== "Cancelled";

    const isStatusChangedToFreeze =
      jobReqStatus === 'Freeze' &&
      existingPlacement.jobReqStatus !== 'Freeze';

    if (
      jobReqStatus === "Closed" &&
      existingPlacement.jobReqStatus !== "Closed" &&
      !mappedStudentFeedback
    ) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Mapped student feedback is required"
      });
    }
    // Prepare update data
    const updateData = {
      jobReqStatus,
      jobTitle,
      jobDescription,
      companyName,
      jobLocation,
      department,
      skillSet,
      additionalSkills,
      qualification,
      passedOutYear,
      experienceRequired,
      salary,
      bond,
      bondDetails,
      interviewType,
      directApplyLink,
      modeOfInterview,
      numberOfOpenings,
      numberOfRounds,
      interviewDate,
      interviewTime,
      interviewLocation,
      venue,
      additionalDetails,
      companyHRName,
      companyHRContact,
      companyHREmail,
      allowedBranches,
      feedbackForClosure,
      totalSelectionCount,
      feedbackForFreeze,
      gender,
    };

    // Remove undefined values to avoid overwriting with null
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Detect changed fields
    const updatedFields = {};

    Object.keys(updateData).forEach(key => {

      const oldValue = existingPlacement[key];
      const newValue = updateData[key];

      // Normalize values before compare
      const normalizedOld =
        oldValue === null || oldValue === undefined
          ? ""
          : String(oldValue).trim();

      const normalizedNew =
        newValue === null || newValue === undefined
          ? ""
          : String(newValue).trim();

      // Compare normalized values
      if (normalizedOld !== normalizedNew) {

        updatedFields[key] = {

          oldValue:
            oldValue === null ||
              oldValue === undefined ||
              oldValue === ""
              ? "-"
              : Array.isArray(oldValue)
                ? oldValue.join(", ")
                : oldValue,

          newValue:
            newValue === null ||
              newValue === undefined ||
              newValue === ""
              ? "-"
              : Array.isArray(newValue)
                ? newValue.join(", ")
                : newValue
        };
      }
    });
    // Fields that should NOT trigger mail
    const ignoredMailFields = [
      "companyHRName",
      "companyHRContact",
      "companyHREmail"
    ];

    // Student-visible fields
    const studentVisibleFields = [
      "jobTitle",
      "jobDescription",
      "jobLocation",
      "salary",
      "bond",
      "bondDetails",
      "interviewType",
      "modeOfInterview",
      "numberOfOpenings",
      "numberOfRounds",
      "interviewDate",
      "interviewTime",
      "interviewLocation",
      "venue",
      "additionalDetails",
      "jobReqStatus"
    ];

    // Actual changed fields
    const changedFieldKeys =
      Object.keys(updatedFields);

    // Remove ignored fields
    const meaningfulFields =
      changedFieldKeys.filter(
        field => !ignoredMailFields.includes(field)
      );

    const filteredUpdatedFields = {};

    Object.keys(updatedFields).forEach(key => {

      if (!ignoredMailFields.includes(key)) {

        filteredUpdatedFields[key] =
          updatedFields[key];
      }
    });

    // Should send any mail?
    const shouldSendMail =
      meaningfulFields.length > 0;

    // Should send student mail?
    const shouldSendStudentMail =
      meaningfulFields.some(field =>
        studentVisibleFields.includes(field)
      ) &&
      jobReqStatus !== "Freeze";
    const isClosureMail =
      ["Closed", "Cancelled"].includes(jobReqStatus) &&
      existingPlacement.jobReqStatus !== jobReqStatus;


    // Update the placement record using jobReqId
    await Placement.update(updateData, {
      where: { jobReqId }
    });

    // If status changed to Cancelled, update all mapped students
    let updatedStudentsCount = 0;

    if (isStatusChangedToCancelled) {

      const mappedStudents = await MappedStudent.findAll({
        where: {
          companyId: jobReqId,
          currentStatus: { [Op.ne]: 'Cancelled' }
        }
      });

      for (const student of mappedStudents) {

        await student.update({
          currentStatus: 'Cancelled',
          feedback: `Job requirement cancelled by ${emp_name}`,
          lastStatusUpdate: new Date()
        });
      }

      updatedStudentsCount = mappedStudents.length;
    }
    // =====================================
    // IF REQUIREMENT CLOSED
    // =====================================

    if (
      jobReqStatus === "Closed" &&
      existingPlacement.jobReqStatus !== "Closed"
    ) {

      const statusesToCancel = [
        "Assigned",
        "Acknowledged",
        "Shortlisted",
        "Interview Scheduled"
      ];

      const mappedStudents =
        await MappedStudent.findAll({

          where: {
            companyId: jobReqId,

            currentStatus: {
              [Op.in]: statusesToCancel
            }
          }
        });

      for (const student of mappedStudents) {

        await student.update({

          currentStatus: "Cancelled",

          feedback:
            mappedStudentFeedback,

          lastStatusUpdate:
            new Date()
        });
      }

      updatedStudentsCount =
        mappedStudents.length;
    }

    // Fetch the updated record to return in response
    const updatedPlacement = await Placement.findOne({
      where: { jobReqId }
    });

    // Send update mail
    try {

      const allStaff = await Employee.findAll({
        attributes: ['email_id', 'emp_name', 'Department', 'branch']
      });

      const placementDepartment =
        department || existingPlacement.department;

      const placementBranches =
        allowedBranches || existingPlacement.allowedBranches;

      const filteredStaff = allStaff.filter(emp => {

        try {

          const deptArray = Array.isArray(emp.Department)
            ? emp.Department
            : JSON.parse(emp.Department || '[]');

          const isDeptMatch =
            deptArray.includes(placementDepartment);

          if (!isDeptMatch) return false;

          const empBranches = Array.isArray(emp.branch)
            ? emp.branch
            : JSON.parse(emp.branch || '[]');

          if (
            !placementBranches ||
            placementBranches === 'All Branches'
          ) {
            return true;
          }

          let allowedBranchArray;

          if (Array.isArray(placementBranches)) {

            allowedBranchArray = placementBranches;

          } else {

            try {
              allowedBranchArray =
                JSON.parse(placementBranches || '[]');
            } catch {
              allowedBranchArray = [placementBranches];
            }
          }

          return empBranches.some(branch =>
            allowedBranchArray.includes(branch)
          );

        } catch (err) {
          console.error("Parse error:", err);
          return false;
        }

      });

      const recipients = filteredStaff
        .map(emp => ({
          email: emp.email_id,
          name: emp.emp_name
        }))
        .filter(emp => emp.email);

      if (
        recipients.length > 0 &&
        shouldSendMail
      ) {

        if (isClosureMail) {

          const closureSummary =
            await exports.getClosureSummaryData(jobReqId);

          await sendPlacementClosureSummaryEmail(
            recipients,
            {
              jobReqId:
                updatedPlacement.jobReqId,

              companyName:
                updatedPlacement.companyName,

              jobTitle:
                updatedPlacement.jobTitle,

              jobReqStatus:
                updatedPlacement.jobReqStatus,

              feedbackForClosure:
                feedbackForClosure || "-",

              summary:
                closureSummary
            }
          );

        } else {

          await sendPlacementUpdateNotification(
            recipients,
            {
              jobReqId:
                updatedPlacement.jobReqId,

              companyName:
                updatedPlacement.companyName,

              jobTitle:
                updatedPlacement.jobTitle,

              updatedFields:
                filteredUpdatedFields
            }
          );
        }

        console.log("✅ Update mail sent");
      }

    } catch (mailErr) {

      console.error(
        "❌ Error sending update mail:",
        mailErr
      );
    }
    // ==============================
    // SEND MAIL TO MAPPED STUDENTS
    // ==============================

    try {

      const mappedStudents = await MappedStudent.findAll({
        where: {
          companyId: jobReqId,
          currentStatus: {
            [Op.ne]: "Rejected By Student"
          }
        }
      });

      if (mappedStudents.length > 0) {

        const studentIds = mappedStudents.map(
          s => s.studentId
        );

        const studentDetails =
          await StudentCourse.findAll({

            where: {
              studentId: {
                [Op.in]: studentIds
              }
            },

            attributes: [
              "studentId",
              "studentName",
              "email_Id"
            ]
          });

        const recipients = studentDetails
          .map(student => ({
            email: student.email_Id,
            name: student.studentName
          }))
          .filter(student => student.email);

        if (
          recipients.length > 0 &&
          shouldSendStudentMail
        ) {

          if (isClosureMail) {

            await sendPlacementClosureStudentEmail(
              recipients,
              {
                companyName:
                  updatedPlacement.companyName,

                jobTitle:
                  updatedPlacement.jobTitle,

                jobReqStatus:
                  updatedPlacement.jobReqStatus
              }
            );

          } else {

            await sendPlacementUpdateStudentEmail(
              recipients,
              {
                jobReqId:
                  updatedPlacement.jobReqId,

                companyName:
                  updatedPlacement.companyName,

                jobTitle:
                  updatedPlacement.jobTitle,

                updatedFields:
                  filteredUpdatedFields
              }
            );
          }

          console.log(
            "✅ Student update mails sent"
          );
        }
      }

    } catch (studentMailErr) {

      console.error(
        "❌ Student mail error:",
        studentMailErr
      );
    }

    const response = {
      message: 'Job requirement updated successfully',
      data: updatedPlacement,
      updatedBy: {
        emp_id,
        emp_name,
        role
      }
    };

    // Add information about updated students if applicable
    if (isStatusChangedToCancelled) {
      response.studentsUpdated = updatedStudentsCount;
      response.statusChangeMessage = `${updatedStudentsCount} student(s) status changed to Cancelled`;
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Error updating job requirement:', error);

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors.map(e => e.message)
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        error: 'Duplicate Error',
        message: 'Job requirement ID already exists'
      });
    }

    if (error.name === 'SequelizeDatabaseError') {
      return res.status(400).json({
        error: 'Database Error',
        message: 'Invalid data provided'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

exports.getClosureSummary = async (req, res) => {

  try {

    const { jobReqId } = req.params;

    // Fetch mapped students
    const mappedStudents = await MappedStudent.findAll({
      where: {
        companyId: jobReqId
      }
    });

    // Count statuses
    const statusCounts = {};

    mappedStudents.forEach(student => {

      const status =
        student.currentStatus || "Unknown";

      statusCounts[status] =
        (statusCounts[status] || 0) + 1;
    });

    // Fetch student course data
    const studentIds = mappedStudents.map(
      s => s.studentId
    );

    const studentsData =
      await StudentCourse.findAll({

        where: {
          studentId: {
            [Op.in]: studentIds
          }
        },

        attributes: [
          "studentId",
          "studentName",
          "branch"
        ]
      });

    // Create lookup map
    const studentMap = {};

    studentsData.forEach(student => {

      studentMap[student.studentId] =
        student;
    });

    // Merge data
    const students = mappedStudents.map(
      student => {

        const studentInfo =
          studentMap[student.studentId];

        return {

          studentName:
            studentInfo?.studentName || "-",

          branch:
            studentInfo?.branch || "-",

          currentStatus:
            student.currentStatus || "-"
        };
      }
    );

    // Custom status order
    const statusOrder = [
      "Selected",
      "Not Selected",
      "Interview Scheduled",
      "Shortlisted",
      "Acknowledged",
      "Assigned",
      "Not Attended",
      "Rejected By Student",
      "Cancelled"
    ];

    // Sort students by status
    students.sort((a, b) => {

      const indexA =
        statusOrder.indexOf(a.currentStatus);

      const indexB =
        statusOrder.indexOf(b.currentStatus);

      return (
        (indexA === -1 ? 999 : indexA) -
        (indexB === -1 ? 999 : indexB)
      );
    });

    res.status(200).json({
      statusCounts,
      students
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to fetch summary"
    });
  }
};
exports.getClosureSummaryData = async (jobReqId) => {

  const mappedStudents =
    await MappedStudent.findAll({
      where: {
        companyId: jobReqId
      }
    });

  const statusCounts = {};

  mappedStudents.forEach(student => {

    const status =
      student.currentStatus || "Unknown";

    statusCounts[status] =
      (statusCounts[status] || 0) + 1;
  });

  const studentIds =
    mappedStudents.map(s => s.studentId);

  const studentsData =
    await StudentCourse.findAll({

      where: {
        studentId: {
          [Op.in]: studentIds
        }
      },

      attributes: [
        "studentId",
        "studentName",
        "branch"
      ]
    });

  const studentMap = {};

  studentsData.forEach(student => {

    studentMap[student.studentId] =
      student;
  });

  const students =
    mappedStudents.map(student => {

      const studentInfo =
        studentMap[student.studentId];

      return {

        studentName:
          studentInfo?.studentName || "-",

        branch:
          studentInfo?.branch || "-",

        currentStatus:
          student.currentStatus || "-"
      };
    });

  return {
    statusCounts,
    students
  };
};
exports.createPlacement = async (req, res) => {
  try {
    const {
      jobReqStatus,
      jobTitle,
      jobDescription,
      companyName,
      jobLocation,
      department,
      skillSet,
      additionalSkills,
      qualification,
      passedOutYear,
      experienceRequired,
      salary,
      bond,
      bondDetails,
      interviewType,
      directApplyLink,
      modeOfInterview,
      numberOfOpenings,
      numberOfRounds,
      interviewDate,
      interviewTime,
      interviewLocation,
      venue,
      additionalDetails,
      companyHRName,
      companyHRContact,
      companyHREmail,
      allowedBranches,
      gender
    } = req.body;

    // 🔹 Generate jobReqId
    const generateJobReqId = async (dept, date) => {
      const dateObj = new Date(date);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = String(dateObj.getFullYear()).slice(-2);
      const formattedDate = `${day}${month}${year}`;

      const deptAbbr = dept.toUpperCase().replace(/\s+/g, '').substring(0, 3);

      const lastPlacement = await Placement.findOne({
        where: {
          jobReqId: {
            [Op.like]: `${deptAbbr}-${formattedDate}-%`
          }
        },
        order: [['jobReqId', 'DESC']]
      });

      let seqNum = 1;
      if (lastPlacement && lastPlacement.jobReqId) {
        const lastSeq = parseInt(lastPlacement.jobReqId.split('-')[2]);
        seqNum = lastSeq + 1;
      }

      return `${deptAbbr}-${formattedDate}-${String(seqNum).padStart(2, '0')}`;
    };

    const createdDate = new Date().toISOString().split('T')[0];
    const jobReqId = await generateJobReqId(department, createdDate);

    console.log("AUTH USER:", req.user);

    const createdContact =
      req.user.contact_num || req.body.createdContact || null;

    // 🔹 Create placement
    const newPlacement = await Placement.create({
      jobReqId,
      jobReqStatus: jobReqStatus || 'Open',
      createdDate,
      createdBy: req.user.emp_name,
      jobTitle,
      jobDescription,
      companyName,
      jobLocation,
      department,
      skillSet,
      additionalSkills,
      qualification,
      passedOutYear,
      experienceRequired,
      salary,
      bond,
      bondDetails,
      interviewType,
      directApplyLink,
      modeOfInterview,
      numberOfOpenings,
      numberOfRounds,
      interviewDate,
      interviewTime,
      interviewLocation,
      venue,
      additionalDetails,
      companyHRName,
      companyHRContact,
      companyHREmail,
      createdContact,
      allowedBranches: allowedBranches || 'All Branches',
      gender
    });

    // 🔹 Send response FIRST (non-blocking email)
    res.status(201).json({
      message: 'Job requirement created successfully',
      data: newPlacement,
      jobReqId
    });

    // 🔹 Send email to matching department staff (SAFE METHOD)
    if (department) {
      try {
        const allStaff = await Employee.findAll({
          attributes: ['email_id', 'emp_name', 'Department', 'branch']
        });

        const filteredStaff = allStaff.filter(emp => {
          try {
            // 🔹 Handle Department
            const deptArray = Array.isArray(emp.Department)
              ? emp.Department
              : JSON.parse(emp.Department || '[]');

            const isDeptMatch = deptArray.includes(department);

            if (!isDeptMatch) return false;

            // 🔹 Handle Branch
            const empBranches = Array.isArray(emp.branch)
              ? emp.branch
              : JSON.parse(emp.branch || '[]');

            // If placement is for ALL branches → allow everyone
            if (!allowedBranches || allowedBranches === 'All Branches') {
              return true;
            }

            // Convert allowedBranches to array (if string)
            let allowedBranchArray;

            if (Array.isArray(allowedBranches)) {
              allowedBranchArray = allowedBranches;
            } else {
              try {
                allowedBranchArray = JSON.parse(allowedBranches || '[]');
              } catch {
                allowedBranchArray = [allowedBranches];
              }
            }

            // Check if employee branch matches any allowed branch
            const isBranchMatch = empBranches.some(branch =>
              allowedBranchArray.includes(branch)
            );

            return isBranchMatch;

          } catch (err) {
            console.error("Branch/Dept parse error:", err);
            return false;
          }
        });

        const recipients = filteredStaff
          .map(emp => ({
            email: emp.email_id,
            name: emp.emp_name
          }))
          .filter(emp => emp.email);

        if (recipients.length > 0) {
          await sendPlacementNotification(recipients, {
            jobTitle,
            companyName,
            department,
            jobLocation,
            interviewDate,
            allowedBranches
          });

          console.log("✅ Emails sent:", recipients.map(r => r.email));
        } else {
          console.warn("⚠️ No matching staff found for department:", department);
        }

      } catch (err) {
        console.error("❌ Error sending placement emails:", err.message);
      }
    } else {
      console.log("⚠️ Department is null → skipping email");
    }

  } catch (error) {
    console.error('❌ Error creating job requirement:', error);

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors.map(e => e.message)
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

exports.getAllPlacements = async (req, res) => {
  try {
    const {
      jobReqStatus = "Open,Freeze",
      department,
      skillSet,
      experienceRequired,
      jobLocation,
      createdBy,
      allowedBranches,
      fromDate,
      toDate,
      searchField,
      searchValue,
      page = 1,
      limit = 10,
      sortBy = "createdDate",
      sortOrder = "DESC"
    } = req.query;

    const whereClause = { [Op.and]: [] };

    // ---------------- STATUS ----------------
    if (jobReqStatus && jobReqStatus !== "All") {
      whereClause[Op.and].push({
        jobReqStatus: {
          [Op.in]: jobReqStatus.split(',').map(s => s.trim())
        }
      });
    }

    // ---------------- DEPARTMENT FILTER ----------------
    if (department) {
      whereClause[Op.and].push({
        department: {
          [Op.in]: department.split(",").map(d => d.trim())
        }
      });
    }

    // ---------------- EXPERIENCE ----------------
    if (experienceRequired) {
      whereClause[Op.and].push({
        experienceRequired: {
          [Op.in]: experienceRequired.split(",").map(e => e.trim())
        }
      });
    }

    // ---------------- LOCATION ----------------
    if (jobLocation) {
      whereClause[Op.and].push({
        jobLocation: {
          [Op.in]: jobLocation.split(",").map(l => l.trim())
        }
      });
    }

    // ---------------- CREATED BY ----------------
    if (createdBy) {
      const arr = createdBy.split(",").map(c => c.trim().toLowerCase());
      whereClause[Op.and].push(
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.fn("TRIM", Sequelize.col("createdBy"))),
          { [Op.in]: arr }
        )
      );
    }

    // ---------------- SKILL SET ----------------
    if (skillSet) {
      const skillsArray = skillSet
        .split("|")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

      skillsArray.forEach(skill => {
        whereClause[Op.and].push(
          Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("skillSet")),
            {
              [Op.regexp]: `(^|,)\\s*${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(,|$)`
            }
          )
        );
      });
    }

    // ---------------- DATE FILTER ----------------
    const today = new Date();
    const defaultFromDate = new Date(today.getFullYear(), today.getMonth() - 2, today.getDate());

    const startDate = fromDate ? new Date(fromDate) : defaultFromDate;
    const endDate = toDate ? new Date(toDate) : today;

    whereClause[Op.and].push({
      createdDate: {
        [Op.between]: [
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
        ]
      }
    });

    // ---------------- SEARCH ----------------
    if (searchField && searchValue) {
      if (searchField === "jobReqId") {
        whereClause[Op.and].push(
          Sequelize.where(
            Sequelize.fn("UPPER", Sequelize.col("jobReqId")),
            { [Op.like]: `%${searchValue.trim().toUpperCase()}%` }
          )
        );
      } else {
        whereClause[Op.and].push({
          [searchField]: { [Op.iLike]: `%${searchValue}%` }
        });
      }
    }

    // =========================================================
    // 🔥 BRANCH FILTER (FIXED CORE LOGIC)
    // =========================================================

    let userBranches = [];

    if (Array.isArray(req.user.branch)) {
      userBranches = req.user.branch;
    } else if (typeof req.user.branch === "string") {
      try {
        userBranches = JSON.parse(req.user.branch);
      } catch {
        userBranches = [req.user.branch];
      }
    }

    userBranches = userBranches.map(b => b.toLowerCase());

    whereClause[Op.and].push(
      Sequelize.literal(`
        (
          LOWER("allowedBranches") LIKE '%all branches%'
          OR EXISTS (
            SELECT 1
            FROM unnest(
              string_to_array(
                REPLACE(REPLACE("allowedBranches",'[',''),']',''),
                ','
              )
            ) AS b
            WHERE LOWER(TRIM(b)) IN (${userBranches.map(b => `'${b}'`).join(",")})
          )
        )
      `)
    );

    // =========================================================
    // 🔥 TRAINER RESTRICTION (FIXED)
    // =========================================================

    if (req.user.role === "Trainer") {
      let trainerDepartments = [];

      if (Array.isArray(req.user.Department)) {
        trainerDepartments = req.user.Department.map(d => d.trim());
      } else if (typeof req.user.Department === "string") {
        trainerDepartments = req.user.Department.split(",").map(d => d.trim());
      }

      // ✅ If NO department → no restriction
      if (trainerDepartments.length > 0) {
        let finalDepartments = [];

        if (department) {
          const requestedDepartments = department.split(",").map(d => d.trim());

          finalDepartments = requestedDepartments.filter(dep =>
            trainerDepartments.includes(dep)
          );
        } else {
          finalDepartments = trainerDepartments;
        }

        whereClause[Op.and].push({
          [Op.or]: [
            {
              department: {
                [Op.in]: finalDepartments
              }
            },
            {
              createdBy: req.user.emp_name
            }
          ]
        });
      }
    }

    console.log("Final WHERE:", JSON.stringify(whereClause, null, 2));

    // ---------------- PAGINATION ----------------
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const offset = (pageNumber - 1) * pageSize;

    const allowedSortFields = [
      "id", "jobTitle", "companyName", "jobLocation", "department",
      "experienceRequired", "salary", "numberOfOpenings",
      "interviewDate", "createdDate", "updatedDate", "jobReqStatus", "jobReqId"
    ];

    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdDate";
    const sortDirection = ["ASC", "DESC"].includes(sortOrder) ? sortOrder : "DESC";

    const { count, rows } = await Placement.findAndCountAll({
      where: whereClause,
      order: [[sortField, sortDirection]],
      limit: pageSize,
      offset
    });

    // ---------------- SEEN / UNSEEN ----------------
    const jobIds = rows.map(r => r.jobReqId);

    const views = await JobRequirementView.findAll({
      where: {
        emp_id: req.user.emp_id,
        jobReqId: { [Op.in]: jobIds }
      }
    });

    const seenMap = {};
    views.forEach(v => (seenMap[v.jobReqId] = true));

    const placements = rows.map(r => ({
      ...r.toJSON(),
      isSeen: !!seenMap[r.jobReqId]
    }));

    // ---------------- RESPONSE ----------------
    res.json({
      success: true,
      data: placements,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(count / pageSize),
        totalRecords: count
      }
    });

  } catch (error) {
    console.error("❌ Error loading placements:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.downloadPlacementsExcel = async (req, res) => {
  try {
    const {
      jobReqStatus = "Open,Freeze",
      department,
      skillSet,
      experienceRequired,
      jobLocation,
      createdBy,
      allowedBranches,
      fromDate,
      toDate,
      searchField,
      searchValue,
      sortBy = "createdDate",
      sortOrder = "DESC"
    } = req.query;

    const whereClause = { [Op.and]: [] };
    // -------- Filters (SAME AS LIST API) --------

    if (jobReqStatus && jobReqStatus !== "All") {
      whereClause[Op.and].push({
        jobReqStatus: {
          [Op.in]: jobReqStatus.split(",").map(s => s.trim())
        }
      });
    }

    if (department) {
      whereClause[Op.and].push({
        department: {
          [Op.in]: department.split(",").map(d => d.trim())
        }
      });
    }

    if (experienceRequired) {
      whereClause[Op.and].push({
        experienceRequired: {
          [Op.iLike]: `%${experienceRequired.trim()}%`
        }
      });
    }

    if (jobLocation) {
      whereClause[Op.and].push({
        jobLocation: {
          [Op.in]: jobLocation.split(",").map(l => l.trim())
        }
      });
    }

    if (createdBy) {
      const arr = createdBy.split(",").map(c => c.trim().toLowerCase());

      whereClause[Op.and].push(
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.fn("TRIM", Sequelize.col("createdBy"))),
          { [Op.in]: arr }
        )
      );
    }

    if (skillSet) {
      const skillsArray = skillSet
        .split("|")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

      skillsArray.forEach(skill => {
        whereClause[Op.and].push(
          Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("skillSet")),
            {
              [Op.regexp]: `(^|,)\\s*${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(,|$)`
            }
          )
        );
      });
    }



    // -------- Date Filter --------
    const today = new Date();
    const defaultFromDate = new Date(today.getFullYear(), today.getMonth() - 2, today.getDate());

    const startDate = fromDate ? new Date(fromDate) : defaultFromDate;
    const endDate = toDate ? new Date(toDate) : today;

    whereClause[Op.and].push({
      createdDate: {
        [Op.between]: [
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
        ]
      }
    });

    if (searchField && searchValue) {
      if (searchField === "jobReqId") {
        whereClause[Op.and] = [
          ...(whereClause[Op.and] || []),
          Sequelize.where(
            Sequelize.fn("UPPER", Sequelize.col("jobReqId")),
            { [Op.like]: `%${searchValue.trim().toUpperCase()}%` }
          )
        ];
      } else {
        whereClause[Op.and].push({
          [searchField]: {
            [Op.iLike]: `%${searchValue}%`
          }
        });
      }
    }

    const allowedSortFields = [
      "jobReqId", "jobTitle", "companyName", "jobLocation",
      "department", "experienceRequired", "salary",
      "numberOfOpenings", "interviewDate",
      "createdDate", "jobReqStatus"
    ];

    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdDate";
    const sortDirection = ["ASC", "DESC"].includes(sortOrder) ? sortOrder : "DESC";

    let userBranches = [];

    if (Array.isArray(req.user.branch)) {
      userBranches = req.user.branch;
    } else if (typeof req.user.branch === "string") {
      try {
        userBranches = JSON.parse(req.user.branch);
      } catch {
        userBranches = [req.user.branch];
      }
    }

    userBranches = userBranches.map(b => b.toLowerCase());

    whereClause[Op.and].push(
      Sequelize.literal(`
    (
      LOWER("allowedBranches") LIKE '%all branches%'
      OR EXISTS (
        SELECT 1
        FROM unnest(
          string_to_array(
            REPLACE(REPLACE("allowedBranches",'[',''),']',''),
            ','
          )
        ) AS b
        WHERE LOWER(TRIM(b)) IN (${userBranches.map(b => `'${b}'`).join(",")})
      )
    )
  `)
    );
    if (req.user.role === "Trainer") {
      let trainerDepartments = [];

      if (Array.isArray(req.user.Department)) {
        trainerDepartments = req.user.Department.map(d => d.trim());
      } else if (typeof req.user.Department === "string") {
        trainerDepartments = req.user.Department.split(",").map(d => d.trim());
      }

      if (trainerDepartments.length > 0) {
        let finalDepartments = [];

        if (department) {
          const requestedDepartments = department.split(",").map(d => d.trim());

          finalDepartments = requestedDepartments.filter(dep =>
            trainerDepartments.includes(dep)
          );
        } else {
          finalDepartments = trainerDepartments;
        }

        whereClause[Op.and].push({
          [Op.or]: [
            {
              department: {
                [Op.in]: finalDepartments
              }
            },
            {
              createdBy: req.user.emp_name
            }
          ]
        });
      }
    }

    const rows = await Placement.findAll({
      where: whereClause,
      order: [[sortField, sortDirection]]
    });

    // -------- Excel Creation --------
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Placements");

    worksheet.columns = [
      { header: "Job Req ID", key: "jobReqId", width: 18 },
      { header: "Company Name", key: "companyName", width: 25 },
      { header: "Job Location", key: "jobLocation", width: 18 },
      { header: "Job Title", key: "jobTitle", width: 25 },
      { header: "Job Description", key: "jobDescription", width: 35 },
      { header: "Salary", key: "salary", width: 15 },
      { header: "Department", key: "department", width: 18 },
      { header: "Skills", key: "skillSet", width: 30 },
      { header: "Qualification", key: "qualification", width: 18 },
      { header: "Passed Out Year", key: "passedOutYear", width: 16 },
      { header: "Experience Required", key: "experienceRequired", width: 22 },
      { header: "Bond", key: "bond", width: 10 },
      { header: "Bond Details", key: "bondDetails", width: 25 },
      { header: "Additional Details", key: "additionalDetails", width: 30 },
      { header: "Mode Of Interview", key: "modeOfInterview", width: 18 },
      { header: "Interview Type", key: "interviewType", width: 20 },
      { header: "Interview Date", key: "interviewDate", width: 18 },
      { header: "Interview Location", key: "interviewLocation", width: 22 },
      { header: "Direct Apply Link", key: "directApplyLink", width: 30 },
      { header: "Interview Time", key: "interviewTime", width: 15 },
      { header: "Venue", key: "venue", width: 22 },
      { header: "Allowed Branches", key: "allowedBranches", width: 25 },
      { header: "Job Status", key: "jobReqStatus", width: 15 },
      { header: "Completion Remarks", key: "feedbackForClosure", width: 15 },
      { header: "Total Selection Count", key: "totalSelectionCount", width: 15 },
      { header: "Created By", key: "createdBy", width: 20 },
      { header: "Created At", key: "createdAt", width: 22 },

    ];
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
    rows.forEach(r => {
      worksheet.addRow({
        jobReqId: r.jobReqId,
        companyName: r.companyName,
        jobLocation: r.jobLocation,
        jobTitle: r.jobTitle,
        jobDescription: r.jobDescription,
        salary: r.salary,
        department: r.department,
        skillSet: r.skillSet,
        qualification: r.qualification,
        passedOutYear: r.passedOutYear,
        experienceRequired: r.experienceRequired,
        bond: r.bond,
        bondDetails: r.bondDetails,
        additionalDetails: r.additionalDetails,
        modeOfInterview: r.modeOfInterview,
        interviewType: r.interviewType,
        interviewDate: r.interviewDate,
        interviewLocation: r.interviewLocation,
        directApplyLink: r.directApplyLink,
        interviewTime: r.interviewTime,
        venue: r.venue,
        allowedBranches: r.allowedBranches,
        jobReqStatus: r.jobReqStatus,
        feedbackForClosure: r.feedbackForClosure,
        totalSelectionCount: r.totalSelectionCount,
        createdBy: r.createdBy,
        createdAt: r.createdAt
          ? new Date(r.createdAt).toLocaleString("en-GB", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
          }).replace(",", "")
          : "",

      });
    });


    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Placements_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Excel download error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPlacementByJobReqId = async (req, res) => {
  try {
    const { jobReqId } = req.params;
    const { emp_id } = req.user;

    const placement = await Placement.findOne({
      where: { jobReqId }
    });

    if (!placement) {
      return res.status(404).json({
        success: false,
        message: "Job not found"
      });
    }

    // Mark job as seen
    await JobRequirementView.findOrCreate({
      where: { jobReqId, emp_id }
    });

    res.json({
      success: true,
      data: placement
    });

  } catch (error) {
    console.error("Error opening job:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUpcomingPlacementsdrive = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'dateOfPlacement',
      sortOrder = 'ASC'
    } = req.query;

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const offset = (pageNumber - 1) * pageSize;

    const allowedSortFields = [
      'dateOfPlacement',
      'companyName',
      'placementOfficerName',
      'salary',
      'status'
    ];

    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'dateOfPlacement';
    const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : 'ASC';

    const { count, rows } = await Placement.findAndCountAll({
      where: { status: 'Awaiting Profiles' }, // ✅ only open placements
      limit: pageSize,
      offset,
      order: [[sortField, sortDirection]]
    });

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        totalRecords: count,
        currentPage: pageNumber,
        totalPages: Math.ceil(count / pageSize),
        recordsPerPage: pageSize,
        hasNextPage: pageNumber < Math.ceil(count / pageSize),
        hasPrevPage: pageNumber > 1
      }
    });
  } catch (error) {
    console.error('Error fetching upcoming placements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming placements',
      error: error.message
    });
  }
};
// 📅 Get Past Placements
exports.getPastPlacements = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'dateOfPlacement',
      sortOrder = 'DESC'
    } = req.query;

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const offset = (pageNumber - 1) * pageSize;

    const allowedSortFields = [
      'dateOfPlacement',
      'companyName',
      'placementOfficerName',
      'salary',
      'status'
    ];

    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'dateOfPlacement';
    const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : 'DESC';

    const { count, rows } = await Placement.findAndCountAll({
      where: { status: ['Abandoned', 'Closed'] }, // ✅ past placements
      limit: pageSize,
      offset,
      order: [[sortField, sortDirection]]
    });

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        totalRecords: count,
        currentPage: pageNumber,
        totalPages: Math.ceil(count / pageSize),
        recordsPerPage: pageSize,
        hasNextPage: pageNumber < Math.ceil(count / pageSize),
        hasPrevPage: pageNumber > 1
      }
    });
  } catch (error) {
    console.error('Error fetching past placements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch past placements',
      error: error.message
    });
  }
};

exports.getUpcomingPlacements = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

    const placements = await Placement.findAll({
      where: {
        dateOfPlacement: {
          [Op.gte]: today  // >= current date
        }
      },
      attributes: ['id', 'companyName'],
      order: [['dateOfPlacement', 'ASC']] // Optional: soonest first
    });

    res.status(200).json({
      success: true,
      data: placements
    });
  } catch (error) {
    console.error('Error fetching upcoming placements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming placements',
      error: error.message
    });
  }
};
// POST /job-feedback
exports.submitJobFeedback = async (req, res) => {
  try {
    const { jobReqId, feedback } = req.body;

    await JobRequirementView.update(
      {
        emp_feedback: feedback,
        emp_name: req.user.emp_name,
        branch: req.user.branch,
        viewedAt: new Date() // ✅ update timestamp
      },
      {
        where: {
          emp_id: req.user.emp_id,
          jobReqId
        }
      }
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getJobViews = async (req, res) => {
  try {
    const { jobReqId } = req.params;

    let whereCondition = { jobReqId };

    // 🔒 Trainer → only own data
    if (req.user.role === 'Trainer') {
      whereCondition.emp_id = req.user.emp_id;
    }

    const data = await JobRequirementView.findAll({
      where: whereCondition,

      // ✅ JSON branch sorting (safe)
      order: [
        [sequelize.literal(`COALESCE((branch::jsonb)->>0, '')`), 'ASC'],
        ['viewedAt', 'DESC']
      ]
    });

    res.json({ success: true, data });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markJobViewed = async (req, res) => {
  try {
    const { jobReqId } = req.params;

    await JobRequirementView.findOrCreate({
      where: {
        emp_id: req.user.emp_id,
        jobReqId
      },
      defaults: {
        emp_name: req.user.emp_name,
        branch: req.user.branch,
        contact_num: req.user.contact_num,
        viewedAt: new Date()
      }
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// GET /job-feedback/status/:jobReqId
exports.checkFeedbackStatus = async (req, res) => {
  try {
    const { jobReqId } = req.params;

    const record = await JobRequirementView.findOne({
      where: {
        emp_id: req.user.emp_id,
        jobReqId,
        emp_feedback: { [Op.ne]: null } // feedback exists
      }
    });

    res.json({ alreadyGiven: !!record });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOldOpenRequirements = async (req, res) => {
  try {
    // Logged-in user name
    const loggedInUser = req.user.emp_name;

    // Today's date
    const today = new Date();

    // 15 days before
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(today.getDate() - 15);

    const oldRequirements = await Placement.findAll({
      where: {
        createdBy: loggedInUser,

        jobReqStatus: {
          [Op.in]: ["Open", "Freeze"]
        },

        createdDate: {
          [Op.lte]: fifteenDaysAgo
        }
      },

      attributes: [
        "id",
        "jobReqId",
        "companyName",
        "jobTitle",
        "jobReqStatus",
        "createdDate",
        "createdBy",
      ],

      order: [["createdDate", "ASC"]]
    });

    const formattedRequirements = oldRequirements.map(req => {

      const created = new Date(req.createdDate);

      const diffTime = today - created;

      const diffDays = Math.floor(
        diffTime / (1000 * 60 * 60 * 24)
      );

      return {
        ...req.toJSON(),
        jobAge: `${diffDays} Days`
      };
    });

    res.status(200).json({
      success: true,
      count: formattedRequirements.length,
      data: formattedRequirements
    });

  } catch (error) {
    console.error("Error fetching old requirements:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


exports.sendEscalationMail = async (req, res) => {

  try {

    const { requirements } = req.body;

    if (!requirements || requirements.length === 0) {

      return res.status(400).json({
        success: false,
        message: "No requirements provided"
      });

    }

    // =========================================
    // FETCH LOGGED-IN EMPLOYEE
    // =========================================

    const loggedInEmployee = await Employee.findOne({
      where: {
        emp_name: req.user.emp_name
      }
    });

    console.log(
      "Logged-in Employee:",
      loggedInEmployee?.email_id
    );

    // =========================================
    // SEND MAIL
    // =========================================

    await sendPlacementEscalationMail(

      [
        {
          email: loggedInEmployee?.email_id
        }
      ],

      requirements

    );

    res.status(200).json({
      success: true,
      message: "Escalation mail sent successfully"
    });

  } catch (error) {

    console.error(
      "Escalation mail error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};