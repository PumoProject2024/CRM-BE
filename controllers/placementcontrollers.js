const Placement = require('../models/Placement');
const MappedStudent = require('../models/Mappedstudents');
const JobRequirementView = require('../models/JobRequirementView');
const { Sequelize, Op } = require('sequelize');
const ExcelJS = require("exceljs");


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
      feedbackForClosure
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
      feedbackForClosure
    };

    // Remove undefined values to avoid overwriting with null
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Check if jobReqStatus is being changed to "Cancelled"
    const isStatusChangedToCancelled =
      jobReqStatus &&
      jobReqStatus === 'Cancelled' &&
      existingPlacement.jobReqStatus !== 'Cancelled';

    // Update the placement record using jobReqId
    await Placement.update(updateData, {
      where: { jobReqId }
    });

    // If status changed to Cancelled, update all mapped students
    let updatedStudentsCount = 0;
    if (isStatusChangedToCancelled) {
      // Find all mapped students for this company
      const mappedStudents = await MappedStudent.findAll({
        where: {
          companyId: jobReqId,
          currentStatus: { [Op.ne]: 'Cancelled' } // Only update students not already cancelled
        }
      });

      // Update each student's status to Cancelled
      for (const student of mappedStudents) {
        await student.update({
          currentStatus: 'Cancelled',
          feedback: `Job requirement cancelled by ${emp_name}`,
          lastStatusUpdate: new Date()
        });
      }

      updatedStudentsCount = mappedStudents.length;
    }

    // Fetch the updated record to return in response
    const updatedPlacement = await Placement.findOne({
      where: { jobReqId }
    });

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

exports.createPlacement = async (req, res) => {
  try {
    const {
      jobReqStatus,
      createdBy,
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
      allowedBranches
    } = req.body;

    // Generate jobReqId with format: <Department>-<Date>-<seq#>
    const generateJobReqId = async (dept, date) => {
      // Format date as DDMMYY
      const dateObj = new Date(date);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = String(dateObj.getFullYear()).slice(-2);
      const formattedDate = `${day}${month}${year}`;

      // Get department abbreviation
      const deptAbbr = dept.toUpperCase().replace(/\s+/g, '').substring(0, 3);

      // Find the last sequence number for this department and date
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

      const seqStr = String(seqNum).padStart(2, '0');
      return `${deptAbbr}-${formattedDate}-${seqStr}`;
    };

    // Auto-generate created date
    const createdDate = new Date().toISOString().split('T')[0];

    // Generate jobReqId using department and createdDate
    const jobReqId = await generateJobReqId(department, createdDate);
    console.log("AUTH USER:", req.user);

    const createdContact = req.user.contact_num || req.body.createdContact || null;


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
      createdContact: createdContact,
      allowedBranches: allowedBranches || 'All Branches'
    });

    res.status(201).json({
      message: 'Job requirement created successfully',
      data: newPlacement,
      jobReqId: jobReqId
    });

  } catch (error) {
    console.error('Error creating job requirement:', error);

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
      jobReqStatus = "Open", // Default to "Open"
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

    const whereClause = {};

    // -------- Filters --------

    // Job Request Status Filter (default: "Open")
    if (jobReqStatus) {
      whereClause.jobReqStatus = jobReqStatus;
    }

    if (department) {
      whereClause.department = { [Op.in]: department.split(",").map(d => d.trim()) };
    }

    if (experienceRequired) {
      whereClause.experienceRequired = { [Op.in]: experienceRequired.split(",").map(e => e.trim()) };
    }

    if (jobLocation) {
      whereClause.jobLocation = { [Op.in]: jobLocation.split(",").map(l => l.trim()) };
    }

    if (createdBy) {
      const arr = createdBy.split(",").map(c => c.trim().toLowerCase());
      whereClause[Op.and] = [
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.fn("TRIM", Sequelize.col("createdBy"))),
          { [Op.in]: arr }
        )
      ];
    }

    if (skillSet) {
      const skills = skillSet.split(",").map(s => s.trim().toLowerCase());
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        ...skills.map(skill =>
          Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("skillSet")),
            { [Op.regexp]: `(^|,)\\s*${skill}\\s*(,|$)` }
          )
        )
      ];
    }

    // -------- Allowed Branches Filter --------
    if (allowedBranches) {
      const branches = allowedBranches.split(",").map(b => b.trim());

      // Build OR condition for each branch
      const branchConditions = branches.map(branch =>
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("allowedBranches")),
          {
            [Op.or]: [
              { [Op.like]: `%${branch.toLowerCase()}%` },
              { [Op.like]: '%all branches%' }
            ]
          }
        )
      );

      whereClause[Op.or] = [
        ...branchConditions,
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("allowedBranches")),
          { [Op.like]: '%all branches%' }
        )
      ];
    }

    // -------- Created Date Filter --------
    // Default to last 1 month if no dates provided
    const today = new Date();
    const defaultFromDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

    const startDate = fromDate ? new Date(fromDate) : defaultFromDate;
    const endDate = toDate ? new Date(toDate) : today;

    whereClause.createdDate = {
      [Op.between]: [
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      ]
    };

    if (searchField && searchValue) {
      if (searchField === 'jobReqId') {
        whereClause[Op.and] = [
          ...(whereClause[Op.and] || []),
          Sequelize.where(
            Sequelize.fn("UPPER", Sequelize.col("jobReqId")),
            {
              [Op.like]: `%${searchValue.trim().toUpperCase()}%`
            }
          )
        ];
      }
      else {
        // Case-insensitive partial match for other fields
        whereClause[searchField] = { [Op.iLike]: `%${searchValue}%` };
      }

    }

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

    // -------- Seen / Unseen Mapping --------
    const jobIds = rows.map(r => r.jobReqId);

    const views = await JobRequirementView.findAll({
      where: {
        emp_id: req.user.emp_id,
        jobReqId: { [Op.in]: jobIds }
      }
    });

    const seenMap = {};
    views.forEach(v => seenMap[v.jobReqId] = true);

    const placements = rows.map(r => ({
      ...r.toJSON(),
      isSeen: !!seenMap[r.jobReqId]
    }));

    res.json({
      success: true,
      data: placements,
      filters: {
        appliedFromDate: startDate.toISOString().split('T')[0],
        appliedToDate: endDate.toISOString().split('T')[0],
        jobReqStatus: jobReqStatus
      },
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(count / pageSize),
        totalRecords: count
      }
    });

  } catch (error) {
    console.error("Error loading placements:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadPlacementsExcel = async (req, res) => {
  try {
    const {
      jobReqStatus = "Open",
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

    const whereClause = {};

    // -------- Filters (SAME AS LIST API) --------

    if (jobReqStatus) {
      whereClause.jobReqStatus = jobReqStatus;
    }

    if (department) {
      whereClause.department = { [Op.in]: department.split(",").map(d => d.trim()) };
    }

    if (experienceRequired) {
      whereClause.experienceRequired = {
        [Op.iLike]: `%${experienceRequired.trim()}%`
      };
    }

    if (jobLocation) {
      whereClause.jobLocation = { [Op.in]: jobLocation.split(",").map(l => l.trim()) };
    }

    if (createdBy) {
      const arr = createdBy.split(",").map(c => c.trim().toLowerCase());
      whereClause[Op.and] = [
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.fn("TRIM", Sequelize.col("createdBy"))),
          { [Op.in]: arr }
        )
      ];
    }

    if (skillSet) {
      const skills = skillSet.split(",").map(s => s.trim().toLowerCase());
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        ...skills.map(skill =>
          Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("skillSet")),
            { [Op.regexp]: `(^|,)\\s*${skill}\\s*(,|$)` }
          )
        )
      ];
    }

    if (allowedBranches) {
      const branches = allowedBranches.split(",").map(b => b.trim().toLowerCase());

      whereClause[Op.or] = [
        ...branches.map(branch =>
          Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("allowedBranches")),
            { [Op.like]: `%${branch}%` }
          )
        ),
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("allowedBranches")),
          { [Op.like]: "%all branches%" }
        )
      ];
    }

    // -------- Date Filter --------
    const today = new Date();
    const defaultFromDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

    const startDate = fromDate ? new Date(fromDate) : defaultFromDate;
    const endDate = toDate ? new Date(toDate) : today;

    whereClause.createdDate = {
      [Op.between]: [
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0]
      ]
    };

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
        whereClause[searchField] = { [Op.iLike]: `%${searchValue}%` };
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
      { header: "Created By", key: "createdBy", width: 20 }
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
        createdBy: r.createdBy
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
