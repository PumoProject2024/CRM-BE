const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Placement = sequelize.define('Placement', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  jobReqId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },

  jobReqStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Open',
  },

  createdDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },

  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  jobTitle: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  jobDescription: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  companyName: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  jobLocation: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  department: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  skillSet: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  additionalSkills: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  qualification: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  passedOutYear: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  experienceRequired: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  salary: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  bond: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  bondDetails: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  interviewType: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  directApplyLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  modeOfInterview: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  numberOfOpenings: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  numberOfRounds: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  interviewDate: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  interviewTime: {
    type: DataTypes.TIME,
    allowNull: true,
  },

  interviewLocation: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  venue: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  additionalDetails: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  companyHRName: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  companyHRContact: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  companyHREmail: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  allowedBranches: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'All Branches',
  },
  feedbackForClosure: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  feedbackForFreeze: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  totalSelectionCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  createdContact: {
    type: DataTypes.STRING,
    allowNull: true,
  },

}, {
  tableName: 'Placements',
  timestamps: true
});

module.exports = Placement;