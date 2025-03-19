const { CourseDetails } = require('../models/CourseDetails');

// Get all courses
exports.getAllCourses = async (req, res) => {
  try {
    const courses = await CourseDetails.findAll();
    res.status(200).json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
