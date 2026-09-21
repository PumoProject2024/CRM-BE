const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MappedStudent = sequelize.define('MappedStudent', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  companyId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Reference to Placement.jobReqId'
  },

  companyName: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  studentId: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  mappedByName: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  mappedByContact: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  interviewDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },

  currentStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Assigned',
    comment: 'Current status in the recruitment workflow (flexible for future additions)'
  },

  feedback: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
    comment: 'General feedback - can be from student or company based on currentStatus'
  },

  statusHistory: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of {status, feedback, timestamp, updatedBy} objects to track status changes'
  },

  lastStatusUpdate: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
    comment: 'Timestamp of the last status change'
  },

  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
    comment: 'Additional notes or remarks'
  },

  acknowledgementStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Pending',
    // Pending | Accepted | Rejected
  },

  acknowledgementFeedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  acknowledgementDate: {
    type: DataTypes.DATE,
    allowNull: true
  },

}, {
  tableName: 'mappedstudents',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['companyId', 'studentId'],
      name: 'unique_company_student_mapping'
    },
    {
      fields: ['currentStatus']
    },
    {
      fields: ['studentId']
    }
  ]
});

// Hook to automatically update statusHistory when currentStatus changes
MappedStudent.addHook('beforeUpdate', (instance, options) => {
  if (instance.changed('currentStatus')) {
    const history = instance.statusHistory || [];
    history.push({
      status: instance.currentStatus,
      feedback: instance.feedback,
      timestamp: new Date(),
      previousStatus: instance._previousDataValues.currentStatus
    });
    instance.statusHistory = history;
    instance.lastStatusUpdate = new Date();
  }
});

module.exports = MappedStudent;