const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Student = sequelize.define('Student', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Name cannot be empty" }
    }
  },
  email_Id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: { msg: "Please provide a valid email address" },
      notEmpty: { msg: "Email cannot be empty" }
    }
  },
  contactNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique:true,
    validate: {
      notEmpty: { msg: "Contact number cannot be empty" }
    }
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  educationLevel: {
    type: DataTypes.STRING,
    allowNull: true
  },
  educationCourse: {
    type: DataTypes.STRING,
    allowNull: true
  },
  department: {
    type: DataTypes.STRING,
    allowNull: true
  },
  passedout: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      isInt: { msg: "Passed out year must be a number" }
    }
  },
  studentStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Active'
  },
  dob: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING,
    allowNull: true
  },
  classType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  learningMode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  batch: {
    type: DataTypes.STRING,
    allowNull: true
  },
  branch: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Branch cannot be empty" }
    }
  },
  adminName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  studentRequirement: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  courseType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  course: {
    type: DataTypes.STRING,
    allowNull: true
  },
  follow_up: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  admin_feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  enrollment_status: {
    type: DataTypes.STRING,
    allowNull: true
  }

}, {
  tableName: 'students',
  timestamps: true
});

module.exports = { Student };