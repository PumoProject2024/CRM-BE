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
    unique: true // Instead of making it primary, make it UNIQUE
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
  ParentNo:{
    type:DataTypes.STRING,
    allowNull:true,
  },
  address: {
    type: DataTypes.TEXT,
    validate: {
      notEmpty: { msg: "Address cannot be empty" }
    }
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
    allowNull: false,
    validate: {
      isIn: {
        args: [['student', 'fresher', 'workingexperience', 'workingexperience1-2', 'workingexperience2-3', 'workingexperience3-4', 'workingexperience4-5',
          'workingexperience5-6', 'workingexperience6-7', 'workingexperience7-8', 'workingexperience8-9', 'workingexperience9-10', 'workingexperience>10'
        ]],
        msg: "Invalid student status"
      }
    }
  },
  dob: {
    type: DataTypes.DATEONLY,
    allowNull: false,
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
    validate: {
      isIn: {
        args: [['9AM-11AM', '12PM-2PM', '3PM-5PM', '6PM-8PM']],
        msg: "Invalid payment mode"
      }
    }
  },
  learningMode: {
    type: DataTypes.STRING
  },
  courseFees: {
    type: DataTypes.DECIMAL(10, 2),
    validate: {
      isDecimal: { msg: "Course Fees should be a decimal number" },
      min: { args: [0], msg: "Course Fees cannot be negative" }
    }
  },
  classType: {
    type: DataTypes.STRING
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
        args: [['Cash', 'Card Payments','UPI', 'Loan']],
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
    allowNull: true,  // ✅ Allows NULL if needed
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
}, {
  tableName: 'student_registrations',
  timestamps: true
});


module.exports = StudentRegistration;
