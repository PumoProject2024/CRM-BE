const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LocationBranch = sequelize.define('LocationBranch', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Location cannot be empty" }
    }
  },
  branch: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Branch cannot be empty" }
    }
  },
  status: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'location_branches',
  timestamps: true
});

module.exports = {  LocationBranch };