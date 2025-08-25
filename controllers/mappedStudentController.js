const MappedStudent = require('../models/Mappedstudents');
const StudentCourse = require('../models/StudentCourse');
const { Op } = require('sequelize');

const mappedStudentController = {
  // POST - Create a new mapped student
  createMappedStudent: async (req, res) => {
    try {
      const {
        companyId,
        companyName,
        interviewDate,
        studentId,
        isAccepted = false,
        isSelected = false
      } = req.body;

      // Validation
      if (!companyId || !companyName || !studentId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID, Company Name, and Student ID are required fields'
        });
      }

      // Check if student is already mapped to this company
      const existingMapping = await MappedStudent.findOne({
        where: {
          companyId,
          studentId
        }
      });

      if (existingMapping) {
        return res.status(409).json({
          success: false,
          message: 'Student is already mapped to this company'
        });
      }

      // Create new mapped student
      const newMappedStudent = await MappedStudent.create({
        companyId,
        companyName,
        interviewDate,
        studentId,
        isAccepted,
        isSelected
      });

      res.status(201).json({
        success: true,
        message: 'Student successfully mapped to company',
        data: newMappedStudent
      });

    } catch (error) {
      console.error('Error creating mapped student:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // GET - Get all mapped students by company ID
  getMappedStudentsByCompanyId: async (req, res) => {
    try {
      const { companyId } = req.params;

      // Validation
      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required'
        });
      }

      // First, get all mapped students for the company
      const mappedStudents = await MappedStudent.findAll({
        where: {
          companyId: companyId
        },
        order: [['createdAt', 'DESC']]
      });

      if (mappedStudents.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No students found for this company'
        });
      }

      // Extract student IDs from mapped students
      const studentIds = mappedStudents.map(ms => ms.studentId);

      // Get student details from StudentCourse table only
      const studentDetails = await StudentCourse.findAll({
        where: {
          studentId: { // Match the field name in your StudentCourse table
            [Op.in]: studentIds
          }
        },
        attributes: ['studentId', 'studentName', 'branch'] // Adjust field names as needed
      });

      // Create a map for quick lookup
      const studentMap = {};
      studentDetails.forEach(student => {
        studentMap[student.studentId] = {
          studentName: student.studentName,
          branch: student.branch
        };
      });

      // Merge the data
      const enrichedData = mappedStudents.map(mappedStudent => {
        const studentData = mappedStudent.toJSON();
        const studentInfo = studentMap[studentData.studentId] || {};
        
        return {
          ...studentData,
          studentName: studentInfo.studentName || null,
          branch: studentInfo.branch || null
        };
      });

      res.status(200).json({
        success: true,
        message: `Found ${mappedStudents.length} mapped student(s) for company ID: ${companyId}`,
        count: mappedStudents.length,
        data: enrichedData
      });

    } catch (error) {
      console.error('Error fetching mapped students by company ID:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },



  // GET - Get all mapped students (bonus method)
  getAllMappedStudents: async (req, res) => {
    try {
      const mappedStudents = await MappedStudent.findAll({
        order: [['createdAt', 'DESC']]
      });

      res.status(200).json({
        success: true,
        message: 'All mapped students retrieved successfully',
        count: mappedStudents.length,
        data: mappedStudents
      });

    } catch (error) {
      console.error('Error fetching all mapped students:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // PUT - Update mapped student status (bonus method)
  updateMappedStudent: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const mappedStudent = await MappedStudent.findByPk(id);

      if (!mappedStudent) {
        return res.status(404).json({
          success: false,
          message: 'Mapped student not found'
        });
      }

      const updatedMappedStudent = await mappedStudent.update(updateData);

      res.status(200).json({
        success: true,
        message: 'Mapped student updated successfully',
        data: updatedMappedStudent
      });

    } catch (error) {
      console.error('Error updating mapped student:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // DELETE - Remove mapped student (bonus method)
  deleteMappedStudent: async (req, res) => {
    try {
      const { id } = req.params;

      const mappedStudent = await MappedStudent.findByPk(id);

      if (!mappedStudent) {
        return res.status(404).json({
          success: false,
          message: 'Mapped student not found'
        });
      }

      await mappedStudent.destroy();

      res.status(200).json({
        success: true,
        message: 'Mapped student deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting mapped student:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

module.exports = mappedStudentController;