const Invoice = require('../models/invoice');
const StudentRegistration = require('../models/studenReg');

// Create Invoice
exports.createInvoice = async (req, res) => {
  try {
    const { studentId, name, date, course, branch, location, registrationPaymentMode, registrationReferenceNo, amount, cgst, sgst, totalAmount } = req.body;

    console.log("Received Invoice Data:", req.body); // Debugging log

    // Ensure the student exists
    const student = await StudentRegistration.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const invoice = await Invoice.create({
      studentId,
      name,
      date,
      course,
      branch,
      location,
      registrationPaymentMode,
      registrationReferenceNo,
      amount,
      cgst,  // Corrected from `gst`
      sgst,  // Corrected from `gst`
      totalAmount
    });

    res.status(201).json(invoice);
  } catch (error) {
    console.error("Error creating invoice:", error); // Log the full error
    res.status(500).json({ error: error.message });
  }
};
