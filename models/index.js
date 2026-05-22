const StudentRegistration = require("./studenReg");
const Invoice = require("./invoice");
const Employee = require("./Employee");
const StudentCourse = require("./StudentCourse");
const Attendance = require("./Attendance");
const MappedStudent = require("./Mappedstudents"); 
const Placement = require("./Placement"); 


// Existing associations
StudentRegistration.hasMany(Invoice, { 
  foreignKey: "studentId",
  sourceKey: "studentId"   // ✅ IMPORTANT
});

Invoice.belongsTo(StudentRegistration, { 
  foreignKey: "studentId",
  targetKey: "studentId"   // ✅ IMPORTANT
});

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


MappedStudent.belongsTo(Placement, {
  foreignKey: "companyId", 
  targetKey: "jobReqId",   // ✅ FIX
  as: "placement"
});

Placement.hasMany(MappedStudent, {
  foreignKey: "companyId",
  sourceKey: "jobReqId",   // ✅ FIX
  as: "mappedStudents"
});


module.exports = { StudentRegistration, Invoice, Employee, StudentCourse,  Attendance , MappedStudent, Placement };