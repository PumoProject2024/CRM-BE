const StudentRegistration = require("./studenReg");
const Invoice = require("./invoice");
const Employee = require("./Employee")

StudentRegistration.hasMany(Invoice, { foreignKey: "studentId" });
Invoice.belongsTo(StudentRegistration, { foreignKey: "studentId" });

Employee.hasMany(Invoice, { foreignKey: "EmpId" });
Invoice.belongsTo(Employee, { foreignKey: "EmpId" });


module.exports = { StudentRegistration, Invoice,Employee };
