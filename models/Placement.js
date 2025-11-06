const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Placement = sequelize.define('Placement', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  jobId: {                // Added jobId field
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },

  placementOfficerName: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  companyName: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  companyLocation: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  contactPerson: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  contactPersonNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  recruitmentRole: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  technology: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  qualification: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  passedOutYear: {
    type: DataTypes.STRING, // or INTEGER if you're strictly storing year
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

  bondDetails: {          // Added bondDetails field
    type: DataTypes.TEXT,
    allowNull: true,
  },

  action: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  dateOfPlacement: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },

  directApply: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  additionalRemarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  
  requirementIdentifiedDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },

  directApplyLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  Department: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  skillSet: {
    type: DataTypes.STRING,
    allowNull: true
  },
  skillKnown: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email:{
   type: DataTypes.STRING,
    allowNull: true,
  },
  status:{
      type: DataTypes.STRING,
    allowNull: true,
  }

}, {
  tableName: 'Placements',
  timestamps: true
});

module.exports = Placement;