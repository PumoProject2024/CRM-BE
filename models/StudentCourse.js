const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StudentCourse = sequelize.define('StudentCourse', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  staffId1: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      notEmpty: { msg: "Staff ID 1 cannot be empty" }
    }
  },
  staffName1: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Staff Name 1 cannot be empty" },
      len: { args: [2, 100], msg: "Staff Name 1 should be between 2 and 100 characters" }
    }
  },
  studentId: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Student ID cannot be empty" }
    }
  },
  studentName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Student name cannot be empty" },
      len: { args: [3, 100], msg: "Student name should be between 3 and 100 characters" }
    }
  },
  studentContactNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Contact number cannot be empty" },
      isNumeric: { msg: "Contact number should contain only numbers" },
      len: { args: [10, 15], msg: "Contact number should be between 10 to 15 digits" }
    }
  },
  educationQualification: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  experience: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  clgName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  batch: {
    type: DataTypes.STRING,

  },
  learningMode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  courseType: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Course type cannot be empty" }
    }
  },
  courseName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Course name cannot be empty" }
    }
  },
  syllabusCovered: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  staffId2: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  staffName2: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: { args: [0, 100], msg: "Staff Name 2 should be maximum 100 characters" }
    }
  },
  staffId3: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  staffName3: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: { args: [0, 100], msg: "Staff Name 3 should be maximum 100 characters" }
    }
  },
  noOfProjects: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: { args: [1], msg: "Number of projects should be at least 1" },
      max: { args: [3], msg: "Number of projects should be maximum 3" }
    }
  },
  projectTitle1: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  projectTitle2: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  projectTitle3: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  project1Status: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: {
        args: [['YTS', 'InProgress', 'Completed']],
        msg: "Project 1 status must be YTS, InProgress, or Completed"
      }
    }
  },
  project2Status: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: {
        args: [['YTS', 'InProgress', 'Completed']],
        msg: "Project 2 status must be YTS, InProgress, or Completed"
      }
    }
  },
  project3Status: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: {
        args: [['YTS', 'InProgress', 'Completed']],
        msg: "Project 3 status must be YTS, InProgress, or Completed"
      }
    }
  },
  staffRemarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ProgressStatus: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  modified_by: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  placementneeded: {
    type: DataTypes.STRING
  },
  branch: {
    type: DataTypes.STRING
  },
  project1Score: { type: DataTypes.FLOAT, allowNull: true },
  project2Score: { type: DataTypes.FLOAT, allowNull: true },
  project3Score: { type: DataTypes.FLOAT, allowNull: true },
  communicationScore: { type: DataTypes.FLOAT, allowNull: true },
  technicalScore: { type: DataTypes.FLOAT, allowNull: true },
  noOfMocktest: { type: DataTypes.INTEGER, allowNull: true },
  mockTest1Score: { type: DataTypes.FLOAT, allowNull: true },
  mockTest2Score: { type: DataTypes.FLOAT, allowNull: true },
  mockTest3Score: { type: DataTypes.FLOAT, allowNull: true },
  courseStartDate: { type: DataTypes.DATEONLY, allowNull: true },
  courseEndDate: { type: DataTypes.DATEONLY, allowNull: true },
  email_Id: {  type: DataTypes.STRING, allowNull: true},
  desiredlocation:{ type: DataTypes.STRING, allowNull: true},
   gender: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tenthPassout: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tenthPercentage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  twelfthPassout: {
    type: DataTypes.STRING,
    allowNull: true
  },
  twelfthPercentage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  collegePassout: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cgpa: {
    type: DataTypes.STRING,
    allowNull: true
  }
  }, {
  tableName: 'student_courses',
  timestamps: true
});

module.exports = StudentCourse;