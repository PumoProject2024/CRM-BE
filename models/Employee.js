const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Employee = sequelize.define("Employee", {
  emp_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
  },
  emp_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  emp_code: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM("BDE", "Trainer", "Placement officer", "Branch-head", "CEO", "Super-Admin"),
    allowNull: false,
  },
  department: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  branch: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  location: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  email_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contact_num: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  alter_contact: {
    type: DataTypes.STRING,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  reset_token: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  reset_token_expires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  modified_by: {
    type: DataTypes.STRING
  },
  // models/Employee.js
  has_access: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

});

module.exports = Employee;
