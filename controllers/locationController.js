const { LocationBranch } = require('../models/LocationBranch');
const { Sequelize } = require('sequelize');


// Get all locations
exports.getAllLocations = async (req, res) => {
  try {
    const locations = await LocationBranch.findAll();
    res.status(200).json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.createLocationBranch = async (req, res) => {
  try {
    const { location = '', branch = '', status = true } = req.body;

    // Basic “not empty” safeguards (Sequelize will also validate)
    if (!location.trim() || !branch.trim()) {
      return res.status(400).json({ message: 'location and branch are required' });
    }

    // Optional: prevent duplicates ─ get by location + branch (case‑insensitive)
    const exists = await LocationBranch.findOne({
      where: {
        location: Sequelize.where(
          Sequelize.fn('LOWER', Sequelize.col('location')),
          Sequelize.fn('LOWER', location)
        ),
        branch: Sequelize.where(
          Sequelize.fn('LOWER', Sequelize.col('branch')),
          Sequelize.fn('LOWER', branch)
        )
      }
    });

    if (exists) {
      return res.status(409).json({ message: 'That location–branch pair already exists' });
    }

    // Create the row
    const newRow = await LocationBranch.create({ location, branch, status });
    return res.status(201).json(newRow);        // 201 = Created
  } catch (error) {
    console.error('Error creating location‑branch:', error);

    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(e => e.message);
      return res.status(400).json({ errors: messages });
    }

    res.status(500).json({ error: 'Internal Server Error' });
  }
};
