const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Employee = sequelize.define("Employee", {
  emp_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  emp_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM("BDE", "Trainer", "Placement officer", "Branch-head", "CEO"),
    allowNull: false,
  },
  department: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  branch: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  location: {
    type: DataTypes.STRING,
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
});

module.exports = Employee;
