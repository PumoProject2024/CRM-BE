const StudentRegistration = require("./studenReg");
const Invoice = require("./invoice");
const Employee = require("./Employee");
const StudentCourse = require("./StudentCourse");

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

module.exports = { StudentRegistration, Invoice, Employee, StudentCourse };