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
      const {
        page = 1,
        limit = 10,
        search,
        searchField,
        dueToday,
        todayPendingFees,
        ...filters
      } = req.query;

      const pageNum = parseInt(page, 10);
      
      const limitNum = parseInt(limit, 10);

      const options = {
        where: {},
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
        order: [["id", "ASC"]],
      };

      // Extract allowed branches from user
      const { branch: allowedBranches } = req.user;

      if (!allowedBranches || allowedBranches.length === 0) {
        return res.status(403).json({ message: "Access denied: No branch assigned" });
      }

      // Ensure branch filtering
      options.where.adminbranch = { [Op.in]: allowedBranches };

      const stringFields = ["name", "contactNo", "course", "batch", "branch", "learningMode"];
      const exactFields = ["id"];

      Object.entries(filters).forEach(([key, value]) => {
        if (stringFields.includes(key)) {
          options.where[key] = { [Op.iLike]: `%${value}%` };
        } else if (exactFields.includes(key)) {
          const idValue = parseInt(value, 10);
          if (!isNaN(idValue)) {
            options.where.id = idValue;
          }
        }
      });

      if (todayPendingFees === "true" || dueToday === "true") {
        options.where.pendingFeesDate = { [Op.eq]: Sequelize.literal("CURRENT_DATE") };
      }

      if (search) {
        options.where[Op.or] = [
          ...stringFields.map((field) => ({ [field]: { [Op.iLike]: `%${search}%` } })),
          Sequelize.where(Sequelize.cast(Sequelize.col("id"), "TEXT"), {
            [Op.iLike]: `%${search}%`,
          }),
        ];
      }

      const { count, rows: registrations } = await StudentRegistration.findAndCountAll(options);

      res.status(200).json({
        totalRegistrations: count,
        totalPages: Math.ceil(count / limitNum),
        currentPage: pageNum,
        registrations,
      });
    } catch (error) {
      console.error("Error fetching student registrations:", error);
      res.status(500).json({
        error: "Internal Server Error",
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

