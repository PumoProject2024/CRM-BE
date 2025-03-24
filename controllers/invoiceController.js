const Invoice = require('../models/invoice');
const StudentRegistration = require('../models/studenReg');

exports.createInvoice = async (req, res) => {
  try {
    const { studentId, receipt_no, registrationPaymentMode, registrationReferenceNo, amount, cgst, sgst, paidAmount, paymentDate } = req.body;

    // ✅ Ensure the logged-in user's data is available from authMiddleware
    const { emp_id, emp_name } = req.user || {};

    if (!emp_id || !emp_name) {
      return res.status(401).json({ error: "Unauthorized: Missing user data" });
    }

    console.log("Logged-in User: ", { emp_id, emp_name });

    // ✅ Validate required fields
    if (!studentId || !receipt_no) {
      return res.status(400).json({ error: "studentId and receipt_no are required" });
    }

    // ✅ Ensure the student exists
    const student = await StudentRegistration.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // ✅ Get the latest payment installment for the student
    const latestInvoice = await Invoice.findOne({
      where: { studentId },
      order: [['paymentInstallment', 'DESC']],
    });
    const nextInstallment = latestInvoice ? latestInvoice.paymentInstallment + 1 : 1;

    // ✅ Create the invoice
    const invoice = await Invoice.create({
      studentId,
      EmpId: emp_id,
      receipt_no,
      registrationPaymentMode,
      registrationReferenceNo,
      amount,
      cgst,
      sgst,
      paidAmount,
      paymentDate,
      paymentInstallment: nextInstallment,
      modified_by: emp_id,
    });

    res.status(201).json({
      message: "Invoice created successfully",
      invoice,
    });
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const { studentId } = req.query;

    const whereConditions = {};
    if (studentId) whereConditions.studentId = studentId;

    const invoices = await Invoice.findAll({
      where: whereConditions,
    });

    res.status(200).json({
      message: 'Invoices retrieved successfully',
      invoices,
    });
  } catch (error) {
    console.error('Error retrieving invoices:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
};
