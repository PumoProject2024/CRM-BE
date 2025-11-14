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
  },
  project2Status: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  project3Status: {
    type: DataTypes.STRING,
    allowNull: true,
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
  email_Id: { type: DataTypes.STRING, allowNull: true },
  desiredlocation: { type: DataTypes.STRING, allowNull: true },
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
  },
  Department: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  skillSet: {
    type: DataTypes.STRING,
    allowNull: true
  },
  knownSkill: {
    type: DataTypes.STRING,
    allowNull: true
  },
  mentor: {
    type: DataTypes.STRING,
    allowNull: true
  },
  mentorid: {
    type: DataTypes.STRING,
    allowNull: true
  },
  mentorNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  readyForPlacement: {
    type: DataTypes.STRING,
    allowNull: true
  },
  stuapprove: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Student approval status for skill updates'
  },
  staffapprove: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Staff approval status for skill updates'
  },
  lastSkillUpdateBy: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Who last updated the skills (staff or student)'
  },
  skillUpdateTimestamp: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When skills were last updated'
  },
  technologyRemarks: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  communicationRemarks: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  progressFeedback: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  mockInterview: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  mockRemarks: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tenthInstitution: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tenthDepartment: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tenthDegree: {
    type: DataTypes.STRING,
    allowNull: true
  },

  twelfthInstitution: {
    type: DataTypes.STRING,
    allowNull: true
  },
  twelfthDepartment: {
    type: DataTypes.STRING,
    allowNull: true
  },
  twelfthDegree: {
    type: DataTypes.STRING,
    allowNull: true
  },

  diplomaInstitution: {
    type: DataTypes.STRING,
    allowNull: true
  },
  diplomaDepartment: {
    type: DataTypes.STRING,
    allowNull: true
  },
  diplomaDegree: {
    type: DataTypes.STRING,
    allowNull: true
  },
  diplomaPassout: {
    type: DataTypes.STRING,
    allowNull: true
  },
  diplomaPercentage: {
    type: DataTypes.STRING,
    allowNull: true
  },

  ugInstitution: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ugDepartment: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ugDegree: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ugPassout: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ugPercentage: {
    type: DataTypes.STRING,
    allowNull: true
  },

  pgInstitution: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pgDepartment: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pgDegree: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pgPassout: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pgPercentage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  placementStatus: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  companyLocation: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  joiningDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  jobRole: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  placedBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  package: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  placementDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },

  expCompanyName1: { type: DataTypes.STRING, allowNull: true },
  expStartDate1: { type: DataTypes.DATEONLY, allowNull: true },
  expEndDate1: { type: DataTypes.DATEONLY, allowNull: true },
  expRole1: { type: DataTypes.STRING, allowNull: true },
  expTechnologies1: { type: DataTypes.STRING, allowNull: true },
  expCurrentlyWorking1: { type: DataTypes.BOOLEAN, allowNull: true },

  expCompanyName2: { type: DataTypes.STRING, allowNull: true },
  expStartDate2: { type: DataTypes.DATEONLY, allowNull: true },
  expEndDate2: { type: DataTypes.DATEONLY, allowNull: true },
  expRole2: { type: DataTypes.STRING, allowNull: true },
  expTechnologies2: { type: DataTypes.STRING, allowNull: true },
  expCurrentlyWorking2: { type: DataTypes.BOOLEAN, allowNull: true },

  expCompanyName3: { type: DataTypes.STRING, allowNull: true },
  expStartDate3: { type: DataTypes.DATEONLY, allowNull: true },
  expEndDate3: { type: DataTypes.DATEONLY, allowNull: true },
  expRole3: { type: DataTypes.STRING, allowNull: true },
  expTechnologies3: { type: DataTypes.STRING, allowNull: true },
  expCurrentlyWorking3: { type: DataTypes.BOOLEAN, allowNull: true },
}, {
  tableName: 'student_courses',
  timestamps: true
});

module.exports = StudentCourse;