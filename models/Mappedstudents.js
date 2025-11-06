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
    defaultValue: null,
  },
  rejectReason: {
  type: DataTypes.TEXT,
  allowNull: true,
  defaultValue: null,
},

  attended: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: null,
    comment: 'null = not marked, true = attended, false = not attended'
  },

  feedback: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
    comment: 'Student feedback about the interview experience'
  },

  attendanceUpdatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
    comment: 'When attendance was last updated'
  },

   isSelected: {
    type: DataTypes.BOOLEAN,
    defaultValue: null,
    comment: 'null = not decided, true = selected, false = not selected'
  },

  selectionFeedback: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
    comment: 'Company feedback about the selection decision'
  },

  selectionUpdatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
    comment: 'When selection status was last updated'
  },


}, {
  tableName: 'MappedStudents',
  timestamps: true,
});

module.exports = MappedStudent;
