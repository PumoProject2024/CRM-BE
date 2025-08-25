const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MappedStudent = sequelize.define('MappedStudent', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  companyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  companyName: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  interviewDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },

  studentId: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  isAccepted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

  isSelected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

}, {
  tableName: 'MappedStudents',
  timestamps: true,
});

module.exports = MappedStudent;
