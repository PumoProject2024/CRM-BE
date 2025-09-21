const MappedStudent = require('../models/Mappedstudents');
const StudentCourse = require('../models/StudentCourse');
const Placement = require('../models/Placement');
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

  updateInterviewAttendance: async (req, res) => {
    try {
      const { companyId } = req.params;
      const { studentId, attended, feedback } = req.body;

      if (!studentId || attended === undefined || !feedback) {
        return res.status(400).json({
          success: false,
          message: 'Student ID, attendance status, and feedback are required'
        });
      }

      const mapping = await MappedStudent.findOne({
        where: {
          studentId: studentId,
          companyId: companyId,
          isAccepted: true // Only for accepted offers
        }
      });

      if (!mapping) {
        return res.status(404).json({
          success: false,
          message: 'Accepted offer not found for this student and company'
        });
      }

      // Check if interview date is today
      const today = new Date().toISOString().split('T')[0];
      const interviewDate = new Date(mapping.interviewDate).toISOString().split('T')[0];

      if (today < interviewDate) {
        return res.status(400).json({
          success: false,
          message: 'Attendance can only be marked on or after the interview date'
        });
      }

      const updateData = {
        attended: attended,
        feedback: feedback.trim(),
        attendanceUpdatedAt: new Date()
      };

      await mapping.update(updateData);

      res.json({
        success: true,
        message: 'Interview attendance updated successfully',
        data: mapping
      });

    } catch (error) {
      console.error('Error updating interview attendance:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update interview attendance',
        error: error.message
      });
    }
  },

  updateStudentSelection: async (req, res) => {
  try {
    const { companyId } = req.params;
    const { studentId, isSelected, selectionFeedback } = req.body;

    // Validate required fields
    if (!studentId || isSelected === undefined || !selectionFeedback) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, selection status, and feedback are required'
      });
    }

    // Find the mapping record
    const mapping = await MappedStudent.findOne({
      where: {
        studentId: studentId,
        companyId: companyId,
        isAccepted: true, // Only for accepted offers
        attended: true    // Only for students who attended the interview
      }
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Student record not found or student has not attended the interview yet'
      });
    }

    // Update the selection status and feedback
    const updateData = {
      isSelected: isSelected,
      selectionFeedback: selectionFeedback.trim(),
      selectionUpdatedAt: new Date()
    };

    await mapping.update(updateData);

    // Fetch updated record with student details for response
    const updatedMapping = await MappedStudent.findOne({
      where: { id: mapping.id },
      include: [{
        model: Student,
        attributes: ['studentName', 'branch']
      }]
    });

    res.json({
      success: true,
      message: `Student ${isSelected ? 'selected' : 'not selected'} successfully`,
      data: updatedMapping
    });

  } catch (error) {
    console.error('Error updating student selection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update student selection status',
      error: error.message
    });
  }
},

  // Get student notifications
  getStudentNotifications: async (req, res) => {
    try {
      const { studentId } = req.params;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required'
        });
      }

      // First, get the mapped companies
      const mappedCompanies = await MappedStudent.findAll({
        where: {
          studentId: studentId
        },
        order: [['createdAt', 'DESC']]
      });

      if (mappedCompanies.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No company notifications found',
          notifications: []
        });
      }

      // Get all unique company IDs
      const companyIds = mappedCompanies.map(mapping => mapping.companyId);

      // Fetch placement details for these companies
      const placements = await Placement.findAll({
        where: {
          id: {
            [Op.in]: companyIds
          }
        },
        attributes: ['id', 'technology', 'salary', 'experienceRequired', 'qualification', 'recruitmentRole']
      });

      // Create a lookup map for placements
      const placementMap = {};
      placements.forEach(placement => {
        placementMap[placement.id] = placement;
      });

      // Combine the data including attendance information
      const notifications = mappedCompanies.map(mapping => {
        const placement = placementMap[mapping.companyId];
        return {
          id: mapping.companyId,
          companyName: mapping.companyName,
          interviewDate: mapping.interviewDate,
          isAccepted: mapping.isAccepted,
          rejectReason: mapping.rejectReason,
          attended: mapping.attended, // null, true, or false
          feedback: mapping.feedback,
          attendanceUpdatedAt: mapping.attendanceUpdatedAt,
          mappingId: mapping.id,
          technology: placement?.technology || 'Not specified',
          salary: placement?.salary || 'Not specified',
          experienceRequired: placement?.experienceRequired || 'Not specified',
          qualification: placement?.qualification || 'Not specified',
          recruitmentRole: placement?.recruitmentRole || 'Not specified'
        };
      });

      res.json({
        success: true,
        notifications: notifications
      });

    } catch (error) {
      console.error('Error fetching student notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications',
        error: error.message
      });
    }
  },

  // Update student response
  updateStudentResponse: async (req, res) => {
    try {
      const { companyId } = req.params;
      const { studentId, isAccepted, rejectReason } = req.body;

      if (!studentId || isAccepted === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Student ID and acceptance status are required'
        });
      }

      const mapping = await MappedStudent.findOne({
        where: {
          studentId: studentId,
          companyId: companyId
        }
      });

      if (!mapping) {
        return res.status(404).json({
          success: false,
          message: 'Student-company mapping not found'
        });
      }

      const updateData = {
        isAccepted: isAccepted
      };

      if (!isAccepted && rejectReason) {
        updateData.rejectReason = rejectReason;
      } else if (isAccepted) {
        updateData.rejectReason = null;
      }

      await mapping.update(updateData);

      res.json({
        success: true,
        message: isAccepted ? 'Offer accepted successfully' : 'Offer rejected successfully',
        data: mapping
      });

    } catch (error) {
      console.error('Error updating student response:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update response',
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