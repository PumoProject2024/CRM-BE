const StudentRegistration = require("./studenReg");
const Invoice = require("./invoice");
const Employee = require("./Employee");
const StudentCourse = require("./StudentCourse");
const Attendance = require("./Attendance");


// Existing associations
StudentRegistration.hasMany(Invoice, { foreignKey: "studentId" });
Invoice.belongsTo(StudentRegistration, { foreignKey: "studentId" });

Employee.hasMany(Invoice, { foreignKey: "EmpId" });
Invoice.belongsTo(Employee, { foreignKey: "EmpId" });

// New StudentCourse associations
StudentRegistration.hasMany(StudentCourse, { 
  foreignKey: "studentId", 
  sourceKey: "studentId",
  as: "studentCourses"
});

StudentCourse.belongsTo(StudentRegistration, { 
  foreignKey: "studentId", 
  targetKey: "studentId",
  as: "studentRegistration"
});
// Attendance associations
StudentRegistration.hasMany(Attendance, { 
  foreignKey: "studentId", 
  sourceKey: "studentId",
  as: "attendanceRecords"
});

Attendance.belongsTo(StudentRegistration, { 
  foreignKey: "studentId", 
  targetKey: "studentId",
  as: "studentRegistration"
});


module.exports = { StudentRegistration, Invoice, Employee, StudentCourse,  Attendance  };