const Invoice = require('../models/invoice');
const StudentRegistration = require('../models/studenReg');
const { Op } = require('sequelize');

exports.createInvoice = async (req, res) => {
  try {
    const { studentId, receipt_no, registrationPaymentMode, registrationReferenceNo, amount, cgst, sgst, paidAmount, paymentDate, bank } = req.body;

    // Ensure the logged-in user's data is available from authMiddleware
    const { emp_id, emp_name } = req.user || {};

    if (!emp_id || !emp_name) {
      return res.status(401).json({ error: "Unauthorized: Missing user data" });
    }

    console.log("Logged-in User: ", { emp_id, emp_name });

    // Validate required fields
    if (!studentId || !receipt_no) {
      return res.status(400).json({ error: "studentId and receipt_no are required" });
    }

    // Ensure the student exists
    const student = await StudentRegistration.findOne({
      where: { studentId: studentId },
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    console.log(`Student found: ${JSON.stringify(student)}`);

    // Get the latest payment installment for the student
    const latestInvoice = await Invoice.findOne({
      where: { studentId },
      order: [['paymentInstallment', 'DESC']],
    });

    const nextInstallment = latestInvoice ? latestInvoice.paymentInstallment + 1 : 1;

    try {
      // Create the invoice
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
        bank,
      });

      res.status(201).json({
        message: "Invoice created successfully",
        invoice,
      });
    } catch (error) {
      // Handle foreign key violation
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
          error: `Foreign key violation: The studentId ${studentId} does not exist in the student_registrations table.`,
        });
      }

      console.error("Error creating invoice:", error);
      res.status(500).json({
        error: "Internal Server Error",
        details: error.message,
      });
    }
  } catch (error) {
    console.error("Error in createInvoice:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const { studentId } = req.query;

    // Validate input
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required.' });
    }

    const invoices = await Invoice.findAll({
      where: { studentId: String(studentId) },
      order: [['createdAt', 'DESC']], // Latest invoices first
    });

    if (!invoices.length) {
      return res.status(404).json({ message: 'No invoices found for this student.' });
    }

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

exports.getAllInvoices = async (req, res) => {
  try {
    // Get user's allowed branches from authMiddleware
    const { branch } = req.user || {};
    const { includeBranchList, includeAnalytics } = req.query;

    // Get filter parameters from request query
    const {
      searchTerm,
      branchFilter,
      dateFilterType,
      startDate,
      endDate,
      sortKey = 'paymentDate',
      sortDirection = 'desc'
    } = req.query;

    if (!branch || !Array.isArray(branch) || branch.length === 0) {
      return res.status(403).json({ error: "No branch access assigned to this user." });
    }

    // Map branches to their codes
    const branchCodeMap = {
      "Tambaram": "TM",
      "Velachery": "VL",
      "Vadapalani": "VP",
      "Poonamallee": "PM",
      "Marathahalli": "MH",
      "Gandhipuram": "GP",
      "Malumichampatti": "MP",
      "Hosur": "HS",
      "Saravanampatti": "SP",
      "Tiruppur": "TP",
      "Padi": "PD",
    };

    // Reverse branch code map for getting branch name from code
    const branchNameMap = Object.entries(branchCodeMap).reduce((acc, [name, code]) => {
      acc[code] = name;
      return acc;
    }, {});

    // Build the where condition
    const whereCondition = {};

    // Handle branch filtering
    let branchCodes = [];
    if (branchFilter && branchFilter !== 'all') {
      const branchCode = branchCodeMap[branchFilter];
      if (branchCode) {
        branchCodes = [branchCode];
      }
    } else {
      branchCodes = branch
        .map(name => branchCodeMap[name])
        .filter(Boolean);
    }

    if (branchCodes.length > 0) {
      whereCondition.studentId = {
        [Op.or]: branchCodes.map(code => ({
          [Op.like]: `%-${code}-%`,
        })),
      };
    }

    // Handle search term
    if (searchTerm) {
      if (whereCondition.studentId) {
        const existingStudentIdFilter = whereCondition.studentId;
        whereCondition[Op.and] = [
          { studentId: existingStudentIdFilter },
          {
            [Op.or]: [
              { studentId: { [Op.like]: `%${searchTerm}%` } },
              { bank: { [Op.like]: `%${searchTerm}%` } }
            ]
          }
        ];
        delete whereCondition.studentId;
      } else {
        whereCondition[Op.or] = [
          { studentId: { [Op.like]: `%${searchTerm}%` } },
          { bank: { [Op.like]: `%${searchTerm}%` } }
        ];
      }
    }

    // Handle date filtering
    if (dateFilterType) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateFilterType === 'today') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        whereCondition.paymentDate = {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        };
      } else if (dateFilterType === 'range' && startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        whereCondition.paymentDate = {
          [Op.gte]: start,
          [Op.lte]: end
        };
      }
    }

    // Determine sort order
    const order = [[sortKey || 'paymentDate', sortDirection || 'DESC']];

    const invoices = await Invoice.findAll({
      where: whereCondition,
      attributes: [
        'studentId',
        'paymentInstallment',
        'paymentDate',
        'bank',
        'paidAmount',
        'registrationPaymentMode',
      ],
      order: order,
    });

    // Calculate statistics
    const totalAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0);

    const paymentTotals = invoices.reduce((acc, invoice) => {
      const mode = invoice.registrationPaymentMode?.toLowerCase() || 'unknown';
      const amount = Number(invoice.paidAmount || 0);

      if (mode.includes('cash')) acc.cash += amount;
      else if (mode.includes('card') || mode.includes('credit') || mode.includes('debit')) acc.card += amount;
      else if (mode.includes('online') || mode.includes('upi') || mode.includes('net banking') || mode.includes('wallet')) acc.online += amount;
      else if (mode.includes('loan')) acc.cheque += amount;
      else acc.other += amount;

      return acc;
    }, { cash: 0, card: 0, online: 0, cheque: 0, other: 0 });

    const paymentModes = {};
    invoices.forEach(invoice => {
      const mode = invoice.registrationPaymentMode || 'Unknown';
      paymentModes[mode] = (paymentModes[mode] || 0) + 1;
    });

    // Calculate branch totals and bank totals for charts
    const branchTotals = {};
    const bankTotals = {};

    invoices.forEach(invoice => {
      // Extract branch code from studentId (format includes "-XX-")
      const branchCodeMatch = invoice.studentId.match(/-([A-Z]{2})-/);
      const branchCode = branchCodeMatch && branchCodeMatch[1] ? branchCodeMatch[1] : 'Unknown';
      const branchName = branchNameMap[branchCode] || 'Unknown';

      // Add to branch totals
      branchTotals[branchName] = (branchTotals[branchName] || 0) + Number(invoice.paidAmount || 0);

      // Add to bank totals
      const bankName = invoice.bank || 'N/A';
      bankTotals[bankName] = (bankTotals[bankName] || 0) + Number(invoice.paidAmount || 0);
    });

    // Prepare response
    const responseData = {
      message: 'Invoices retrieved successfully',
      invoices,
      stats: {
        totalCount: invoices.length,
        totalAmount,
        paymentTotals,
        paymentModes
      }
    };

    // Add chart analytics data if requested
    if (includeAnalytics === 'true') {
      responseData.stats.branchTotals = branchTotals;
      responseData.stats.bankTotals = bankTotals;
    }

    // Add branch list if requested
    if (includeBranchList === 'true') {
      responseData.availableBranches = branch;
    }

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
};
 