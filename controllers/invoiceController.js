const Invoice = require('../models/invoice');
const StudentRegistration = require('../models/studenReg');

// Create Invoice
exports.createInvoice = async (req, res) => {
  try {
    const { studentId, name, receipt_no, registrationPaymentMode, registrationReferenceNo, amount, cgst, sgst, feescollected, pendingFees, pendingFeesDate } = req.body;

    console.log("Received Invoice Data:", req.body);
    
    if (!receipt_no) {
      return res.status(400).json({ error: "receipt_no is required" });
    }

    // Ensure the student exists
    const student = await StudentRegistration.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Creating the invoice
    const invoice = await Invoice.create({
      studentId,
      name,
      receipt_no,
      registrationPaymentMode,
      registrationReferenceNo,
      amount,
      cgst,
      sgst,
      feescollected,
      pendingFees,
      pendingFeesDate,
      paymentInstallment: 1
    });

    res.status(200).json(invoice);
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ error: error.message });
  }
};
