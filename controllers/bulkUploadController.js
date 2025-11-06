const XLSX = require('xlsx');
const StudentRegistration = require('../models/studenReg');
const Invoice = require('../models/invoice');
const StudentRecord = require('../models/StudentCourse'); // Assuming this is your student-record model
const { Op } = require('sequelize');

// Branch and Course Type abbreviations (same as your existing code)
const BRANCH_ABBREVIATIONS = {
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

const COURSE_TYPE_ABBREVIATIONS = {
  "CADD": "CD",
  "Pumo Tech IT": "PI",
  "Pumo Tech Automation": "PA",
  "Monz Creative School": "MZ",
};

const getBranchAbbreviation = (branchName) => {
  if (!branchName) return "UNK";
  if (BRANCH_ABBREVIATIONS[branchName]) {
    return BRANCH_ABBREVIATIONS[branchName];
  }
  return branchName.substring(0, 2).toUpperCase();
};

const getCourseTypeAbbreviation = (courseType) => {
  if (!courseType) return "CR";
  if (COURSE_TYPE_ABBREVIATIONS[courseType]) {
    return COURSE_TYPE_ABBREVIATIONS[courseType];
  }
  return courseType.substring(0, 2).toUpperCase();
};

// Generate student ID (same logic as your existing code)
const generateNextId = async (branch, courseType) => {
  const branchAbbr = getBranchAbbreviation(branch);
  const courseAbbr = getCourseTypeAbbreviation(courseType || 'Course');

  const branchPattern = `%-${branchAbbr}-%`;

  const allBranchStudents = await StudentRegistration.findAll({
    where: { studentId: { [Op.like]: branchPattern } },
    attributes: ['studentId'],
    raw: true
  });

  let highestNumber = 1000;

  if (allBranchStudents.length > 0) {
    allBranchStudents.forEach(student => {
      const parts = student.studentId.split('-');
      if (parts.length === 3) {
        const number = parseInt(parts[2], 10);
        if (!isNaN(number) && number > highestNumber) {
          highestNumber = number;
        }
      }
    });
  }

  const nextNumber = highestNumber + 1;
  return `${courseAbbr}-${branchAbbr}-${nextNumber}`;
};

// Format date function
const formatDate = (dateValue) => {
  if (!dateValue) return null;
  
  // If it's already a Date object
  if (dateValue instanceof Date) {
    return dateValue.toISOString().split('T')[0];
  }
  
  // If it's a string, try to parse it
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // If it's an Excel serial date number
  if (typeof dateValue === 'number') {
    const date = XLSX.SSF.parse_date_code(dateValue);
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  
  return null;
};

// Generate receipt number
const generateReceiptNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `REC${timestamp}${random}`;
};

// Main bulk upload controller
const bulkUploadController = {
  uploadExcel: async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      console.log('📁 File upload details:', {
        hasFile: !!req.file,
        fileName: req.file?.filename || req.file?.originalname,
        fileSize: req.file?.size,
        mimetype: req.file?.mimetype,
        hasBuffer: !!req.file?.buffer,
        bufferLength: req.file?.buffer?.length
      });

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      let workbook;
      let jsonData;

      try {
        // Handle different file upload scenarios
        if (req.file.buffer) {
          // Memory storage - use buffer
          console.log('📊 Reading from buffer...');
          workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        } else if (req.file.path) {
          // Disk storage - read from file path
          console.log('📊 Reading from file path:', req.file.path);
          workbook = XLSX.readFile(req.file.path);
        } else {
          throw new Error('No valid file buffer or path found');
        }

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          throw new Error('No worksheets found in the Excel file');
        }

        console.log('📋 Sheet name:', sheetName);
        const worksheet = workbook.Sheets[sheetName];
        jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log('📊 Parsed data:', {
          totalRows: jsonData.length,
          firstRow: jsonData[0] ? Object.keys(jsonData[0]).slice(0, 5) : 'No data'
        });

      } catch (xlsxError) {
        console.error('❌ XLSX parsing error:', xlsxError);
        return res.status(400).json({ 
          message: 'Failed to parse Excel file. Please ensure it\'s a valid .xlsx or .xls file.',
          error: xlsxError.message 
        });
      }

      if (!jsonData || jsonData.length === 0) {
        return res.status(400).json({ message: 'Excel file is empty or has no valid data' });
      }

      const results = {
        successful: [],
        failed: [],
        totalRecords: jsonData.length
      };

      // Process each row
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2; // Excel row number (starting from 2, assuming row 1 is header)

        try {
          // ============ STEP 1: CREATE STUDENT REGISTRATION ============
          
          // Check for existing student
          const existingStudent = await StudentRegistration.findOne({
            where: {
              course: row.course || '',
              [Op.or]: [
                { email_Id: row.email_Id || '' },
                { contactNo: row.contactNo || '' }
              ]
            }
          });

          if (existingStudent) {
            results.failed.push({
              row: rowNumber,
              data: row,
              error: `Student with email ${row.email_Id} or contact ${row.contactNo} already exists for course ${row.course}`
            });
            continue;
          }

          // Generate student ID
          const studentId = await generateNextId(row.adminbranch, row.courseType);

          // Prepare registration data
          const registrationData = {
            studentId,
            name: row.name,
            email_Id: row.email_Id || null,
            contactNo: row.contactNo,
            ParentNo: row.ParentNo || null,
            address: row.address,
            educationLevel: row.educationLevel === "Others" ? row.otherEducationLevel : row.educationLevel,
            educationCourse: row.educationCourse,
            department: row.department === "Others" ? row.otherDepartment : row.department,
            clg_name: row.clg_name,
            studentStatus: row.studentStatus,
            dob: formatDate(row.dob),
            courseType: row.courseType,
            course: row.course,
            courseDuration: row.courseDuration,
            batch: row.batch === "Others" ? row.otherBatch : row.batch,
            learningMode: row.learningMode,
            courseFees: parseFloat(row.courseFees) || 0,
            classType: row.classType,
            demoGivenBy: row.demoGivenBy,
            demoGivenDate: formatDate(row.demoGivenDate),
            registrationPaymentMode: row.registrationPaymentMode || "Cash",
            registrationReferenceNo: row.registrationReferenceNo || "",
            discountAmount: parseFloat(row.discountAmount) || 0,
            adminEmpName: row.adminEmpName || user.emp_name,
            dateOfAdmission: formatDate(row.dateOfAdmission),
            feesCollected: parseFloat(row.feesCollected) || 0,
            balanceFee: parseFloat(row.balanceFee) || 0,
            pendingFees: parseFloat(row.pendingFees) || 0,
            pendingFeesDate: row.pendingFees > 0 ? formatDate(row.pendingFeesDate) : null,
            pendingFees2: null,
            pendingFeesDate2: null,
            pendingFees3: null,
            pendingFeesDate3: null,
            pendingFees4: null,
            pendingFeesDate4: null,
            source: row.source,
            studentRequestedLocation: row.studentRequestedLocation,
            studentRequestedBranch: row.studentRequestedBranch,
            adminlocation: row.adminlocation,
            adminbranch: row.adminbranch,
            adminFeedback: row.adminFeedback,
            studentRequirement: row.studentRequirement,
            placementneeded: row.placementneeded,
            staffAssigned: row.staffAssigned,
            staffAssignedId: row.staffAssignedId,
            sharingBranch: row.sharingBranch || null,
            sharingAdminName: row.sharingAdminName || null,
            sharingAmount: row.sharingAmount || null,
            studentProgressStatus: row.studentProgressStatus,
            modified_by: user.emp_id
          };

          // Create student registration
          const newRegistration = await StudentRegistration.create(registrationData);

          // ============ STEP 2: CREATE INVOICES ============
          
          const invoicesCreated = [];
          
          // Process installments (assuming columns like installment1_amount, installment1_date, etc.)
          const maxInstallments = 4; // Adjust based on your needs
          
          for (let installmentNum = 1; installmentNum <= maxInstallments; installmentNum++) {
            const amountKey = `installment${installmentNum}_amount`;
            const dateKey = `installment${installmentNum}_date`;
            const paymentModeKey = `installment${installmentNum}_paymentMode`;
            const referenceKey = `installment${installmentNum}_reference`;
            const bankKey = `installment${installmentNum}_bank`;
            
            const installmentAmount = parseFloat(row[amountKey]) || 0;
            
            if (installmentAmount > 0) {
              const receiptNumber = generateReceiptNumber();
              const paymentMode = row[paymentModeKey] || "Cash";
              
              // Calculate tax amounts
              const cgstAmount = installmentAmount * 0.09;
              const sgstAmount = installmentAmount * 0.09;
              const baseAmount = installmentAmount * 0.82;
              
              const invoiceData = {
                EmpId: user.emp_id,
                studentId: studentId,
                receipt_no: receiptNumber,
                registrationPaymentMode: paymentMode,
                registrationReferenceNo: paymentMode === 'Cash' ? '' : (row[referenceKey] || ""),
                amount: paymentMode === 'Cash' ? 0 : baseAmount,
                cgst: paymentMode === 'Cash' ? 0 : cgstAmount,
                sgst: paymentMode === 'Cash' ? 0 : sgstAmount,
                bank: row[bankKey] || "",
                paymentInstallment: installmentNum,
                paidAmount: installmentAmount,
                paymentDate: formatDate(row[dateKey]) || formatDate(row.dateOfAdmission),
                modified_by: user.emp_id
              };
              
              const invoice = await Invoice.create(invoiceData);
              invoicesCreated.push(invoice);
            }
          }

          // ============ STEP 3: CREATE STUDENT RECORD ============
          
          const studentRecordData = {
            studentId: studentId,
            studentName: row.name,
            clgName: row.clg_name,
            studentContactNumber: row.contactNo,
            educationQualification: row.educationCourse,
            courseType: row.courseType,
            courseName: row.course,
            staffId1: row.staffAssignedId,
            staffName1: row.staffAssigned,
            experience: row.studentStatus,
            batch: registrationData.batch,
            learningMode: row.learningMode,
            branch: row.studentRequestedBranch,
            placementneeded: row.placementneeded,
            ProgressStatus: row.studentProgressStatus,
            email_Id: row.email_Id
          };

          const studentRecord = await StudentRecord.create(studentRecordData);

          // Success
          results.successful.push({
            row: rowNumber,
            studentId: studentId,
            name: row.name,
            invoicesCount: invoicesCreated.length,
            data: {
              registration: newRegistration,
              invoices: invoicesCreated,
              studentRecord: studentRecord
            }
          });

        } catch (error) {
          console.error(`Error processing row ${rowNumber}:`, error);
          results.failed.push({
            row: rowNumber,
            data: row,
            error: error.message || 'Unknown error occurred'
          });
        }
      }

      // Return results
      res.status(200).json({
        message: 'Bulk upload completed',
        results: {
          total: results.totalRecords,
          successful: results.successful.length,
          failed: results.failed.length,
          successfulRecords: results.successful,
          failedRecords: results.failed
        }
      });

    } catch (error) {
      console.error('Bulk upload error:', error);
      res.status(500).json({
        message: 'Bulk upload failed',
        error: error.message
      });
    }
  },

  // Get sample Excel template
  downloadTemplate: async (req, res) => {
    try {
      const templateData = [
        {
          name: "John Doe",
          email_Id: "john@example.com",
          contactNo: "9876543210",
          ParentNo: "9876543211",
          address: "123 Main Street, City",
          educationLevel: "Bachelor's",
          educationCourse: "Computer Science",
          department: "IT",
          clg_name: "ABC College",
          studentStatus: "Student",
          dob: "1995-01-15",
          courseType: "CADD",
          course: "AutoCAD",
          courseDuration: "3 Months",
          batch: "9AM-11AM",
          learningMode: "Offline",
          courseFees: 15000,
          classType: "Regular",
          demoGivenBy: "Staff1",
          demoGivenDate: "2024-01-01",
          registrationPaymentMode: "Cash",
          registrationReferenceNo: "",
          discountAmount: 1000,
          dateOfAdmission: "2024-01-05",
          feesCollected: 5000,
          balanceFee: 10000,
          pendingFees: 5000,
          pendingFeesDate: "2024-02-05",
          source: "Online",
          studentRequestedLocation: "Chennai",
          studentRequestedBranch: "Tambaram",
          adminlocation: "Chennai",
          adminbranch: "Tambaram",
          adminFeedback: "Good candidate",
          studentRequirement: "Basic course",
          placementneeded: "Yes",
          staffAssigned: "Staff1",
          staffAssignedId: "EMP001",
          studentProgressStatus: "Active",
          installment1_amount: 5000,
          installment1_date: "2024-01-05",
          installment1_paymentMode: "Cash",
          installment1_reference: "",
          installment1_bank: "",
          installment2_amount: 5000,
          installment2_date: "2024-02-05",
          installment2_paymentMode: "UPI",
          installment2_reference: "UPI123456",
          installment2_bank: "SBI",
          installment3_amount: 0,
          installment3_date: "",
          installment3_paymentMode: "",
          installment3_reference: "",
          installment3_bank: "",
          installment4_amount: 0,
          installment4_date: "",
          installment4_paymentMode: "",
          installment4_reference: "",
          installment4_bank: ""
        }
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Student_Template');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', 'attachment; filename=student_bulk_upload_template.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      res.send(buffer);

    } catch (error) {
      console.error('Template download error:', error);
      res.status(500).json({
        message: 'Failed to generate template',
        error: error.message
      });
    }
  }
};

module.exports = bulkUploadController;