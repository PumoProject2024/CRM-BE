const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Placement = sequelize.define('Placement', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
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

}, {
  tableName: 'Placements',
  timestamps: true
});

module.exports = Placement;
