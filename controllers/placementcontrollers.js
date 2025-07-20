const Placement = require('../models/Placement');

exports.createPlacement = async (req, res) => {
  try {
    const {
      studentid,
      companyname,
      companylocation,
      package,
      result,
      companyfeeback,
      placementofficerfeedback,
      dateofplacement
    } = req.body;

    const loggedInUserId = req.user.emp_id;

    const existingCount = await Placement.count({
      where: { studentid }
    });

    const newPlacement = await Placement.create({
      studentid,
      companyname,
      companylocation,
      package,
      result,
      companyfeeback,
      placementofficerfeedback,
      companies: existingCount + 1,
      dateofplacement, // 👈 new field
      modified_by: loggedInUserId
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
