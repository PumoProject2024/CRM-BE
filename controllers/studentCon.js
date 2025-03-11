const StudentRegistration = require('../models/studenReg');

class StudentRegistrationController {
    // Create a new student registration
    static async createStudentRegistration(req, res) {
      try {
        const studentData = req.body;
  
        // Create student registration
        const newRegistration = await StudentRegistration.create(studentData);
  
        res.status(200).json({
          message: 'Student Registration Created Successfully',
          student: newRegistration
        });
      } catch (error) {
        console.error('Error creating student registration:', error);
        res.status(500).json({
          error: 'Internal Server Error',
          details: error.message
        });
      }
    }
    // Get all student registrations
        // Update an existing student registration
        static async updateStudentRegistration(req, res) {
            try {
                const { id } = req.params;
                const updateData = req.body;
    
                // Find the student registration by ID
                const student = await StudentRegistration.findByPk(id);
    
                if (!student) {
                    return res.status(404).json({
                        error: 'Student Registration Not Found'
                    });
                }
    
                // Update the student registration
                await student.update(updateData);
    
                res.status(200).json({
                    message: 'Student Registration Updated Successfully',
                    student
                });
            } catch (error) {
                console.error('Error updating student registration:', error);
                res.status(500).json({
                    error: 'Internal Server Error',
                    details: error.message
                });
            }
        }
    
}

module.exports = StudentRegistrationController;

