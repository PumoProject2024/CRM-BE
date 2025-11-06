const StudentPlacement = require('../models/StudentPlacement');

exports.createStudentPlacement = async (req, res) => {
  try {
    const {
      studentId,
      companyId,
      companyName,
      status,
      companyFeedback,
      placementOfficerFeedback,
      studentFeedback
    } = req.body;

    const newRecord = await StudentPlacement.create({
      studentId,
      companyId,
      companyName,
      status,
      companyFeedback,
      placementOfficerFeedback,
      studentFeedback
    });

    res.status(201).json({
      success: true,
      message: 'Student placement record created successfully',
      data: newRecord
    });

  } catch (error) {
    console.error('Error creating student placement record:', error);

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.errors.map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
};

exports.getStudentPlacements = async (req, res) => {
  try {
    const {
      studentId,
      companyId,
      status,
      page = 1,
      limit = 10
    } = req.query;

    const whereClause = {};

    if (studentId) whereClause.studentId = studentId;
    if (companyId) whereClause.companyId = companyId;
    if (status) whereClause.status = status;

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const offset = (pageNumber - 1) * pageSize;

    const { count, rows } = await StudentPlacement.findAndCountAll({
      where: whereClause,
      limit: pageSize,
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        totalRecords: count,
        currentPage: pageNumber,
        totalPages: Math.ceil(count / pageSize),
        recordsPerPage: pageSize
      }
    });

  } catch (error) {
    console.error('Error fetching student placement records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch records',
      error: error.message
    });
  }
};

exports.getStudentPlacementsByStudentId = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'studentId parameter is required'
      });
    }

    const placements = await StudentPlacement.findAll({
      where: { studentId },
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: placements
    });

  } catch (error) {
    console.error('Error fetching placement records for student:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student placement records',
      error: error.message
    });
  }
};
