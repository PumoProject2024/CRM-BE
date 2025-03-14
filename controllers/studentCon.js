const { Op, Sequelize } = require('sequelize');
const StudentRegistration = require('../models/studenReg');

class StudentRegistrationController {
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


  static async getAllStudentRegistrations(req, res) {
    try {
      // Extract pagination and filter parameters from the request
      const { page = 1, limit = 10, search, searchField, dueToday, todayPendingFees, ...filters } = req.query;
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
  
      // Ensure valid pagination values
      const options = {
        where: {},
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
        order: [['id', 'ASC']], // Sort by student id in ascending order

      };
  
      // Define columns by type:
      const stringFields = ['name', 'contactNo', 'course', 'batch', 'location', 'branch', 'learningMode'];
      const exactFields = ['id'];
  
      // Apply filters for specific fields
      Object.keys(filters).forEach((key) => {
        if (stringFields.includes(key)) {
          options.where[key] = { [Op.iLike]: `%${filters[key]}%` };
        } else if (exactFields.includes(key)) {
          const idValue = parseInt(filters[key], 10);
          if (!isNaN(idValue)) {
            options.where.id = { [Op.and]: [
              { [Op.gte]: idValue },
              Sequelize.literal(`("id" - ${idValue}) % 10 = 0`)
            ] };
          }
        } else if (key === 'pendingFeesDate') {
          options.where.pendingFeesDate = filters[key];
        }
      });
  
      // Handle special search case for today's pending fees
      if (todayPendingFees === 'true' || dueToday === 'true') {
        options.where.pendingFeesDate = {
          [Op.eq]: Sequelize.literal('CURRENT_DATE'),
        };
      }
      // Handle regular search (partial match across multiple columns)
      else if (search) {
        if (searchField && (stringFields.includes(searchField) || exactFields.includes(searchField))) {
          // Search in specific field if provided
          if (stringFields.includes(searchField)) {
            options.where[searchField] = { [Op.iLike]: `%${search}%` };
          } else if (exactFields.includes(searchField)) {
            const searchId = parseInt(search, 10);
            if (!isNaN(searchId)) {
              options.where.id = { [Op.and]: [
                { [Op.gte]: searchId },
                Sequelize.literal(`("id" - ${searchId}) % 10 = 0`)
              ] };
            }
          }
        } else {
          // Global search across multiple fields
          options.where[Op.or] = [
            ...stringFields.map((field) => ({
              [field]: { [Op.iLike]: `%${search}%` },
            })),
            Sequelize.where(Sequelize.cast(Sequelize.col('id'), 'TEXT'), {
              [Op.iLike]: `%${search}%`,
            }),
          ];
        }
      }
  
      // Execute the query using Sequelize's findAndCountAll method
      const { count, rows: registrations } = await StudentRegistration.findAndCountAll(options);
  
      // Send the paginated response
      res.status(200).json({
        totalRegistrations: count,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        registrations,
      });
    } catch (error) {
      console.error('Error fetching student registrations:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        details: error.message,
      });
    }
  }
  

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

