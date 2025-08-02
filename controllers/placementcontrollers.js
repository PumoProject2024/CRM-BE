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
      action,
      dateOfPlacement,
      directApply,
      additionalRemarks
    } = req.body;

    const newPlacement = await Placement.create({
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
      action,
      dateOfPlacement,
      directApply,
      additionalRemarks
    });

    res.status(201).json({
      message: 'Placement record created successfully',
      data: newPlacement
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

exports.getPlacements = async (req, res) => {
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
      'salary'
    ];

    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'dateOfPlacement';
    const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase())
      ? sortOrder.toUpperCase()
      : 'DESC';

    const { count, rows } = await Placement.findAndCountAll({
      limit: pageSize,
      offset,
      order: [[sortField, sortDirection]]
    });

    const totalPages = Math.ceil(count / pageSize);

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        totalRecords: count,
        currentPage: pageNumber,
        totalPages,
        recordsPerPage: pageSize,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1
      }
    });
  } catch (error) {
    console.error('Error fetching placement records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch placements',
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
