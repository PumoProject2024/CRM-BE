const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// MariaDB/InnoDB limits the declared width of a row to 65,535 bytes (excluding TEXT/BLOB). With 93
// VARCHAR(255) columns in utf8mb4 this table needed ~95 KB, so 35 free-text / history columns are TEXT.
// TEXT is a strict superset of the previous VARCHAR(255): no existing value can be truncated.
// Columns used for grouping, filtering, defaults or as keys deliberately remain VARCHAR(255).
// Scores are DOUBLE (PostgreSQL FLOAT was 8-byte; MariaDB FLOAT is only 4-byte).
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
  experience: {
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
  projectTitle1: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  projectTitle2: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  projectTitle3: {
    type: DataTypes.TEXT,
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
  placementInterest: {
    type: DataTypes.STRING,
    allowNull: true
  },
  project1Score: { type: DataTypes.DOUBLE, allowNull: true },
  project2Score: { type: DataTypes.DOUBLE, allowNull: true },
  project3Score: { type: DataTypes.DOUBLE, allowNull: true },
  project1Feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  project2Feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  project3Feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  communicationScore: { type: DataTypes.DOUBLE, allowNull: true },
  technicalScore: { type: DataTypes.DOUBLE, allowNull: true },
  mockTest1Score: { type: DataTypes.DOUBLE, allowNull: true },
  mockTest2Score: { type: DataTypes.DOUBLE, allowNull: true },
  mockTest3Score: { type: DataTypes.DOUBLE, allowNull: true },
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
    type: DataTypes.TEXT,
    allowNull: true
  },
  knownSkill: {
    type: DataTypes.TEXT,
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
  readyForPlacementDate: {
    type: DataTypes.DATE,
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
    type: DataTypes.TEXT,
    allowNull: true,
  },
  communicationRemarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  mockInterview: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  mockRemarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tenthInstitution: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tenthDepartment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tenthDegree: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  twelfthInstitution: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  twelfthDepartment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  twelfthDegree: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  diplomaInstitution: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  diplomaDepartment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  diplomaDegree: {
    type: DataTypes.TEXT,
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
    type: DataTypes.TEXT,
    allowNull: true
  },
  ugDepartment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ugDegree: {
    type: DataTypes.TEXT,
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
    type: DataTypes.TEXT,
    allowNull: true
  },
  pgDepartment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  pgDegree: {
    type: DataTypes.TEXT,
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
    defaultValue: "Awaiting for placement"
  },
  placementRemarks: {
    type: DataTypes.TEXT,
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

  expCompanyName1: { type: DataTypes.TEXT, allowNull: true },
  expStartDate1: { type: DataTypes.DATEONLY, allowNull: true },
  expEndDate1: { type: DataTypes.DATEONLY, allowNull: true },
  expRole1: { type: DataTypes.STRING, allowNull: true },
  expTechnologies1: { type: DataTypes.TEXT, allowNull: true },
  expCurrentlyWorking1: { type: DataTypes.BOOLEAN, allowNull: true },

  expCompanyName2: { type: DataTypes.TEXT, allowNull: true },
  expStartDate2: { type: DataTypes.DATEONLY, allowNull: true },
  expEndDate2: { type: DataTypes.DATEONLY, allowNull: true },
  expRole2: { type: DataTypes.STRING, allowNull: true },
  expTechnologies2: { type: DataTypes.TEXT, allowNull: true },
  expCurrentlyWorking2: { type: DataTypes.BOOLEAN, allowNull: true },

  expCompanyName3: { type: DataTypes.TEXT, allowNull: true },
  expStartDate3: { type: DataTypes.DATEONLY, allowNull: true },
  expEndDate3: { type: DataTypes.DATEONLY, allowNull: true },
  expRole3: { type: DataTypes.STRING, allowNull: true },
  expTechnologies3: { type: DataTypes.TEXT, allowNull: true },
  expCurrentlyWorking3: { type: DataTypes.BOOLEAN, allowNull: true },

  photoReview: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  photoReviewLink: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  photoReviewReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  videoReview: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  videoReviewLink: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  videoReviewReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  googleReview: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  googleReviewStars: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 5
    }
  },
  googleReviewReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  placementStatusChangedBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  placementStatusChangedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  mappingCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Total number of times this student has been mapped to a company'
  },
  joiningStatus: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  verificationRemarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  verificationUpdatedBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  verificationUpdatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'student_courses',
  timestamps: true
});

module.exports = StudentCourse;