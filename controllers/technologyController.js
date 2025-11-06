const { Technology } = require('../models/Technology');

// Create Technology (POST)
exports.createTechnology = async (req, res) => {
    try {
        const { Department, skillKnown } = req.body;

        if (!Department || !skillKnown) {
            return res.status(400).json({
                success: false,
                message: "Both Department and skillKnown are required"
            });
        }

        const newTech = await Technology.create({ Department, skillKnown });

        res.status(201).json({
            success: true,
            message: "Technology added successfully",
            data: newTech
        });
    } catch (error) {
        console.error("Error creating technology:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// Get All Technologies (GET)
exports.getTechnologies = async (req, res) => {
    try {
        const techList = await Technology.findAll({
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            success: true,
            data: techList
        });
    } catch (error) {
        console.error("Error fetching technologies:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};
