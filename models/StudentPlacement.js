const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StudentPlacement = sequelize.define('StudentPlacement', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  studentId: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  companyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  companyName: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  status: {
    type: DataTypes.ENUM('Selected', 'Not Selected', 'Pending'),
    allowNull: false,
  },

  companyFeedback: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  placementOfficerFeedback: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  studentFeedback: {
    type: DataTypes.TEXT,
    allowNull: true,
  }

}, {
  tableName: 'student_placements',
  timestamps: true,
});

module.exports = StudentPlacement;
