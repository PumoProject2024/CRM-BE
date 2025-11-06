const { CourseDetails } = require('../models/CourseDetails');
const { Technology } = require('../models/Technology');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

// Create a new course
exports.createCourse = async (req, res) => {
  try {
    // Extract user email from token to track who created the course
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Create course
    const newCourse = await CourseDetails.create({
      courseType: req.body.courseType,
      courseName: req.body.courseName,
      courseDuration: req.body.courseDuration,
      courseFees: req.body.courseFees
    });

    res.status(201).json({
      message: 'Course created successfully',
      course: newCourse
    });
  } catch (error) {
    console.error('Error creating course:', error);
    
    // Handle validation errors
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        error: 'Validation Error',
        details: error.errors.map(e => e.message)
      });
    }

    // Handle other errors
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
};

// Get all courses
exports.getAllCourses = async (req, res) => {
  try {
    const { courseName } = req.query;

    const whereClause = {};
    if (courseName) {
      whereClause.courseName = {
        [Op.iLike]: `%${courseName}%`  // case-insensitive partial match
      };
    }

    const courses = await CourseDetails.findAll({
      where: whereClause,
      attributes: { exclude: ['createdAt', 'updatedAt'] }
    });

    res.status(200).json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


// Get course by ID
exports.getCourseById = async (req, res) => {
  try {
    const course = await CourseDetails.findByPk(req.params.id);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.status(200).json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getCourseByNameAndType = async (req, res) => {
  try {
    const { courseName, courseType } = req.params;

    // Fetch course details by name and type
    const course = await CourseDetails.findOne({ 
      where: { courseName, courseType } 
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.status(200).json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Update a course
exports.updateCourse = async (req, res) => {
  try {
    const [updated] = await CourseDetails.update(
      {
        courseType: req.body.courseType,
        courseName: req.body.courseName,
        courseDuration: req.body.courseDuration,
        courseFees: req.body.courseFees
      }, 
      {
        where: { id: req.params.id }
      }
    );

    if (updated) {
      const updatedCourse = await CourseDetails.findByPk(req.params.id);
      return res.status(200).json({
        message: 'Course updated successfully',
        course: updatedCourse
      });
    }

    throw new Error('Course not found');
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Delete a course
exports.deleteCourse = async (req, res) => {
  try {
    const deleted = await CourseDetails.destroy({
      where: { id: req.params.id }
    });

    if (deleted) {
      return res.status(200).json({ 
        message: 'Course deleted successfully' 
      });
    }

    throw new Error('Course not found');
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getCoursesByDepartment = async (req, res) => {
  try {
    const { Department } = req.query;

    if (!Department) {
      return res.status(400).json({ success: false, message: "Department is required" });
    }

    // ✅ Fetch all courses (case-insensitive match)
    const courses = await CourseDetails.findAll({
      where: {
        Department: {
          [Op.iLike]: Department.trim()
        }
      },
      attributes: ['courseName']
    });

    // ✅ Fetch all skills under this department
    const techRecords = await Technology.findAll({
      where: {
        Department: {
          [Op.iLike]: Department.trim()
        }
      },
      attributes: ['skillKnown']
    });

    // Merge multiple skills into one array
    const skills = techRecords.map(t => t.skillKnown);

    res.status(200).json({
      success: true,
      Department,
      courses: courses.map(c => c.courseName),
      skills
    });

  } catch (error) {
    console.error("Error in getCoursesByDepartment:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};