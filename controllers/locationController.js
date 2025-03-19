const { LocationBranch } = require('../models/LocationBranch');

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