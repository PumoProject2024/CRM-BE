const Placement = require('../models/Placement');
const { Op } = require('sequelize');

exports.createPlacement = async (req, res) => {
  try {
    const {
      placementOfficerName,
      companyName,
      companyLocation,
      contactPerson,
      contactPersonNumber,
      recruitmentRole,
      technology,
      qualification,
      passedOutYear,
      experienceRequired,
      salary,
      bond,
      bondDetails,     
      action,
      dateOfPlacement,
      directApply,
      additionalRemarks,
      requirementIdentifiedDate,
      directApplyLink,
      Department,
      email,
      status,
      skillSet,           
      skillKnown          
    } = req.body;

    // Generate jobId with format: <Department>-<Date>-<seq#>
    const generateJobId = async (department, date) => {
      // Format date as DDMMYY
      const dateObj = new Date(date);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = String(dateObj.getFullYear()).slice(-2);
      const formattedDate = `${day}${month}${year}`;
      
      // Get department abbreviation (you might want to customize this based on your departments)
      const deptAbbr = department.toUpperCase().replace(/\s+/g, '').substring(0, 3);
      
      // Find the last sequence number for this department and date
      const lastPlacement = await Placement.findOne({
        where: {
          jobId: {
            [Op.like]: `${deptAbbr}-${formattedDate}-%`
          }
        },
        order: [['jobId', 'DESC']]
      });
      
      let seqNum = 1;
      if (lastPlacement && lastPlacement.jobId) {
        const lastSeq = parseInt(lastPlacement.jobId.split('-')[2]);
        seqNum = lastSeq + 1;
      }
      
      const seqStr = String(seqNum).padStart(2, '0');
      return `${deptAbbr}-${formattedDate}-${seqStr}`;
    };

    // Generate jobId using Department and requirementIdentifiedDate (or current date if not provided)
    const jobIdDate = requirementIdentifiedDate || new Date().toISOString().split('T')[0];
    const jobId = await generateJobId(Department, jobIdDate);

    const newPlacement = await Placement.create({
      jobId,               // Added jobId
      placementOfficerName,
      companyName,
      companyLocation,
      contactPerson,
      contactPersonNumber,
      recruitmentRole,
      technology,
      qualification,
      passedOutYear,
      experienceRequired,
      salary,
      bond,
      bondDetails,         // Added bondDetails
      action,
      dateOfPlacement,
      directApply,
      additionalRemarks,
      requirementIdentifiedDate,
      directApplyLink,
      skillSet,
      email,
      status,
      Department,
      skillSet,          
      skillKnown         
    });

    res.status(201).json({
      message: 'Placement record created successfully',
      data: newPlacement,
      jobId: jobId        // Return the generated jobId
    });

  } catch (error) {
    console.error('Error creating placement record:', error);

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

exports.updatePlacement = async (req, res) => {
  try {
    const { id } = req.params; // Get placement ID from URL parameters
    
    // Extract user information from the authenticated request
    const { emp_id, emp_name, role } = req.user;
    
    const {
      placementOfficerName,
      companyName,
      companyLocation,
      contactPerson,
      contactPersonNumber,
      recruitmentRole,
      technology,
      qualification,
      passedOutYear,
      experienceRequired,
      salary,
      bond,
      bondDetails,
      action,
      dateOfPlacement,
      directApply,
      additionalRemarks,
      requirementIdentifiedDate,
      directApplyLink,
      Department,
      email,
      status,
      skillSet,           
      skillKnown          
    } = req.body;

    // Check if placement record exists
    const existingPlacement = await Placement.findByPk(id);
    
    if (!existingPlacement) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Placement record not found'
      });
    }

    // Authorization check: Only super-admin or the placement officer who created the record can update
    const isSuperAdmin = role === 'Super-Admin';
    const isOwner = existingPlacement.placementOfficerName === emp_name;
    
    if (!isSuperAdmin && !isOwner) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to update this placement record. Only super-admins or the original placement officer can make changes.'
      });
    }

    // If user is not super-admin, ensure they can't change the placementOfficerName to someone else's name
    if (!isSuperAdmin && placementOfficerName && placementOfficerName !== emp_name) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You cannot assign this placement record to another placement officer.'
      });
    }

    // Prepare update data - for non-super-admin users, ensure placementOfficerName remains their name
    const updateData = {
      placementOfficerName: isSuperAdmin ? placementOfficerName : emp_name, // Enforce ownership for non-super-admin
      companyName,
      companyLocation,
      contactPerson,
      contactPersonNumber,
      recruitmentRole,
      technology,
      qualification,
      passedOutYear,
      experienceRequired,
      salary,
      bond,
      bondDetails,
      action,
      dateOfPlacement,
      directApply,
      additionalRemarks,
      requirementIdentifiedDate,
      directApplyLink,
      skillSet,
      email,
      status,
      Department,
      skillKnown         
    };

    // Remove undefined values to avoid overwriting with null
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Update the placement record
    const [updatedRowsCount] = await Placement.update(updateData, {
      where: { id },
      returning: true // This will return the updated record (PostgreSQL)
    });

    // Fetch the updated record to return in response
    const updatedPlacement = await Placement.findByPk(id);

    res.status(200).json({
      message: 'Placement record updated successfully',
      data: updatedPlacement,
      updatedBy: {
        emp_id,
        emp_name,
        role
      }
    });

  } catch (error) {
    console.error('Error updating placement record:', error);

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors.map(e => e.message)
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
