const Invoice = require('../models/invoice');
const StudentRegistration = require('../models/studenReg');

// Create Invoice
exports.createInvoice = async (req, res) => {
  try {
    const { studentId, EmpId, receipt_no, registrationPaymentMode, registrationReferenceNo, amount, cgst, sgst, paidAmount, paymentDate } = req.body;

    console.log("Received Invoice Data:", req.body);

    if (!receipt_no) {
      return res.status(400).json({ error: "receipt_no is required" });
    }

    // Ensure the student exists
    const student = await StudentRegistration.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Get the latest payment installment for the student
    const latestInvoice = await Invoice.findOne({
      where: { studentId },
      order: [['paymentInstallment', 'DESC']]
    });

    const nextInstallment = latestInvoice ? latestInvoice.paymentInstallment + 1 : 1;

    // Creating the invoice
    const invoice = await Invoice.create({
      studentId,
      EmpId,
      receipt_no,
      registrationPaymentMode,
      registrationReferenceNo,
      amount,
      cgst,
      sgst,
      paidAmount,
      paymentDate,
      paymentInstallment: nextInstallment
    });

    res.status(200).json(invoice);
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ error: error.message });
  }
};

