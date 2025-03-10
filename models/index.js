const StudentRegistration = require("./studenReg");
const Invoice = require("./invoice");

StudentRegistration.hasMany(Invoice, { foreignKey: "studentId" });
Invoice.belongsTo(StudentRegistration, { foreignKey: "studentId" });

module.exports = { StudentRegistration, Invoice };
