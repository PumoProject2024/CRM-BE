const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StudentRegistration = sequelize.define('StudentRegistration', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true, // id should be the primary key
  },
  studentId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Name cannot be empty" },
      len: { args: [3, 100], msg: "Name should be between 3 and 100 characters" }
    }
  },
  email_Id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  contactNo: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Contact number cannot be empty" },
      isNumeric: { msg: "Contact number should contain only numbers" },
      len: { args: [10, 15], msg: "Contact number should be between 10 to 15 digits" }
    }
  },
  ParentNo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,

  },
  educationLevel: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  educationCourse: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  department: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  clg_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  studentStatus: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: {
        args: [['Student', 'Fresher', 'Internship', 'Working Experience', 'Working Experience 1-2', 'Working Experience 2-3', 'Working Experience 3-4', 'Working Experience 4-5',
          'Working Experience 5-6', 'Working Experience 6-7', 'Working Experience 7-8', 'Working Experience 8-9', 'Working Experience 9-10', 'Working Experience >10'
        ]],
        msg: "Invalid student status"
      }
    }
  },
  dob: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    validate: {
      isDate: { msg: "Date of Birth must be a valid date" }
    }
  },
  courseType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  course: {
    type: DataTypes.STRING,
    allowNull: false
  },
  courseDuration: {
    type: DataTypes.STRING
  },
  batch: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  learningMode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  courseFees: {
    type: DataTypes.DECIMAL(10, 2),
    validate: {
      isDecimal: { msg: "Course Fees should be a decimal number" },
      min: { args: [0], msg: "Course Fees cannot be negative" }
    }
  },
  classType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  demoGivenBy: {
    type: DataTypes.STRING
  },
  demoGivenDate: {
    type: DataTypes.DATEONLY,
    validate: {
      isDate: { msg: "Demo Given Date must be a valid date" }
    }
  },
  registrationPaymentMode: {
    type: DataTypes.STRING,
    validate: {
      isIn: {
        args: [['Cash', 'Card Payments', 'UPI', 'Loan']],
        msg: "Invalid payment mode"
      }
    }
  },
  registrationReferenceNo: {
    type: DataTypes.STRING
  },
  discountAmount: {
    type: DataTypes.DECIMAL(10, 2),
    validate: {
      isDecimal: { msg: "Discount Amount should be a decimal number" },
      min: { args: [0], msg: "Discount Amount cannot be negative" }
    }
  },
  adminEmpName: {
    type: DataTypes.STRING
  },
  dateOfAdmission: {
    type: DataTypes.DATEONLY,
    validate: {
      isDate: { msg: "Date of Admission must be a valid date" }
    }
  },
  feesCollected: {
    type: DataTypes.DECIMAL(10, 2),
    validate: {
      isDecimal: { msg: "Fees Collected should be a decimal number" },
      min: { args: [0], msg: "Fees Collected cannot be negative" }
    }
  },
  pendingFees: {
    type: DataTypes.DECIMAL(10, 2),
    validate: {
      isDecimal: { msg: "Pending Fees should be a decimal number" },
      min: { args: [0], msg: "Pending Fees cannot be negative" }
    }
  },
  pendingFeesDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,  // ✅ Allows NULL if needed
    validate: {
      isDate: { msg: "Pending Fees Date must be a valid date" }
    }
  },
  pendingFees2: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,  // ✅ Allows NULL if needed
    validate: {
      isDecimal: { msg: "Pending Fees should be a decimal number" },
      min: { args: [0], msg: "Pending Fees cannot be negative" }
    }
  },
  pendingFeesDate2: {
    type: DataTypes.DATEONLY,
    allowNull: true,  // ✅ Allows NULL if needed
    validate: {
      isDate: { msg: "Pending Fees Date must be a valid date" }
    }
  },
  pendingFees3: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,  // ✅ Allows NULL if needed
    validate: {
      isDecimal: { msg: "Pending Fees should be a decimal number" },
      min: { args: [0], msg: "Pending Fees cannot be negative" }
    }
  },
  pendingFeesDate3: {
    type: DataTypes.DATEONLY,
    allowNull: true,  // ✅ Allows NULL if needed
    validate: {
      isDate: { msg: "Pending Fees Date must be a valid date" }
    }
  },
  pendingFees4: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,  // ✅ Allows NULL if needed
    validate: {
      isDecimal: { msg: "Pending Fees should be a decimal number" },
      min: { args: [0], msg: "Pending Fees cannot be negative" }
    }
  },
  pendingFeesDate4: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    validate: {
      isDate: { msg: "Pending Fees Date must be a valid date" }
    }
  },
  source: {
    type: DataTypes.STRING
  },
  studentRequestedLocation: {
    type: DataTypes.STRING
  },
  studentRequestedBranch: {
    type: DataTypes.STRING
  },
  adminlocation: {
    type: DataTypes.STRING
  },
  adminbranch: {
    type: DataTypes.STRING
  },
  adminFeedback: {
    type: DataTypes.TEXT
  },
  studentRequirement: {
    type: DataTypes.TEXT
  },
  placementneeded: {
    type: DataTypes.STRING
  },
  staffAssigned: {
    type: DataTypes.STRING
  },
  modified_by: {
    type: DataTypes.STRING
  },
  sharingBranch: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sharingAdminName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sharingAmount: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  studentProgressStatus: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  profilePicPath: {
    type: DataTypes.STRING,
    allowNull: true
  },
  resumePath: {
    type: DataTypes.STRING,
    allowNull: true
  },
  password: {
  type: DataTypes.STRING,
  allowNull: true, // Initially null, will be set after first login
  validate: {
    len: { args: [8, 100], msg: "Password should be between 8 and 100 characters" }
  }
},
 
}, {
  tableName: 'student_registrations',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['contactNo', 'course']
    }
  ]
});


module.exports = StudentRegistration;
