const express = require('express');
const StudentRegistrationController = require('../controllers/studentCon');
const employeeController = require("../controllers/employeeController");
const authMiddleware = require("../middleware/authMiddleware");
const studentAuthMiddleware = require('../middleware/studentAuthMiddleware');
const studentOrStaffAuthMiddleware = require("../middleware/studentOrStaffAuthMiddleware");
const { createInvoice, getInvoices } = require('../controllers/invoiceController');
const { getAllCourses, createCourse, updateCourse, deleteCourse, getCourseByNameAndType, getCoursesByDepartment, } = require('../controllers/courseController');
const { getAllLocations, createLocationBranch } = require('../controllers/locationController');
const passwordController = require("../controllers/passwordController");
const studentController = require("../controllers/studentController");
const { getAllEmployeeDetails } = require("../controllers/employeeController");
const { getAllInvoices } = require('../controllers/invoiceController');
const studentCourseController = require('../controllers/studentCourseController');
const attendanceController = require('../controllers/attendanceController');
const { createPlacement, getPlacementByJobReqId, getUpcomingPlacements, getPastPlacements, getUpcomingPlacementsdrive, updatePlacement, getAllPlacements, downloadPlacementsExcel, submitJobFeedback, getJobViews, markJobViewed, checkFeedbackStatus, getClosureSummary, getOldOpenRequirements, sendEscalationMail } = require('../controllers/placementcontrollers');
const { upload, uploadFile } = require('../controllers/uploadController');
const bulkUploadController = require('../controllers/bulkUploadController');
const syllabusController = require('../controllers/syllabusController');
const { createStudentPlacement, getStudentPlacementsByStudentId } = require('../controllers/studentPlacementController');
const { downloadResume, downloadBulkResumes, downloadAllResumes, downloadResumes, downloadMappedStudentsResumes, downloadOfferLetter } = require('../controllers/resumeDownloadController');
const technologyController = require('../controllers/technologyController');
const placementController = require('../controllers/placementController');
const mappedStudentController = require("../controllers/mappedStudentController");
const { getPlacedStudentsReport, getAwaitingStudentsReport, getJobRequirementReport, getJobRequirementDetails, downloadBranchPPT, getPlacedStudentsDetails, getPlacedByReport } = require('../controllers/reportController');



const router = express.Router();


router.post('/upload-syllabus', upload.single('file'), syllabusController.uploadSyllabusExcel);
router.get('/modules/:courseType/:courseName', syllabusController.getModules);

router.post('/bulkupload', authMiddleware, upload.single('excelFile'), bulkUploadController.uploadExcel);

// POST route to create a new student registration
router.get('/location', getAllLocations);
router.post('/loc', createLocationBranch);


router.post("/student", studentController.createStudent);
router.get("/students", authMiddleware, studentController.getAllStudents);
router.put('/students/:id', authMiddleware, studentController.updateStudent);
router.get("/students/:contactNo", studentController.getStudentByContactNo);
router.get('/bde-employees', employeeController.getBDEEmployees);

router.get('/pending-details', authMiddleware, StudentRegistrationController.getPendingDetails);

router.post('/password/forgot', passwordController.requestPasswordReset);
router.get('/password/verify/:userType/:id/:token', passwordController.verifyResetToken);
router.post('/password/reset', passwordController.resetPassword);
router.post("/reset-default-password", authMiddleware, passwordController.resetToDefaultPassword);

router.post('/create-course', authMiddleware, createCourse);
router.get('/course', getAllCourses);
router.get('/course-by-department', getCoursesByDepartment);
router.put('/courses/:id', updateCourse);
router.delete('/courses/:id', deleteCourse);
router.get('/courses/:courseName/:courseType', getCourseByNameAndType);

router.post('/registrations', authMiddleware, StudentRegistrationController.createStudentRegistration);
router.post('/invoices', authMiddleware, createInvoice);
router.get('/invoices', getInvoices);
router.get('/all-invoices', authMiddleware, getAllInvoices);


// GET route to fetch all student registrations
router.get('/allregistrations', authMiddleware, StudentRegistrationController.getAllStudentRegistrations);
router.get('/completedCourse', authMiddleware, StudentRegistrationController.getCompletedStudentsWithNoPendingFees);
router.put('/registrations/:studentId', authMiddleware, StudentRegistrationController.updateStudentRegistration);
router.put('/update/:id', authMiddleware, StudentRegistrationController.updateStudentRegistrationById);

router.post("/register", employeeController.createEmployee); // Allow first registration without auth
router.post("/login", employeeController.loginEmployee); // No middleware here
router.get("/regdetail", authMiddleware, employeeController.getEmployees);
router.get("/all-employees", authMiddleware, getAllEmployeeDetails);
router.put('/regdetail/update', authMiddleware, employeeController.updateEmployeeProfile);
router.post('/changepassword', authMiddleware, employeeController.changePassword);
router.put("/employees/:emp_id", employeeController.updateEmployeeById);
router.delete("/employees/:emp_id", employeeController.deleteEmployeeById);

router.post('/student-record', studentCourseController.create);
router.get('/students-record', authMiddleware, studentCourseController.getAll);
router.get('/student-rec/:id', authMiddleware, studentCourseController.getById);
router.get('/placed-record', authMiddleware, studentCourseController.placed);
router.put('/students-record/:id', authMiddleware, studentCourseController.update);
router.get("/trainers", employeeController.getTrainerEmployees);

router.get("/placement-officer", employeeController.getPlacementOfficerNames);
router.get("/employees", employeeController.getEmployeeNames);



router.post('/attendance', authMiddleware, attendanceController.createAttendance);
router.get('/attendance/:studentId', authMiddleware, attendanceController.getAttendanceByStudentId);
router.put('/attendance/:id', authMiddleware, attendanceController.updateAttendance);
router.delete('/attendance/:id/day/:day', authMiddleware, attendanceController.deleteAttendanceDay);

router.get('/placement-ready', authMiddleware, studentCourseController.getPlacementEligibleStudents);
router.get('/placedstudent', authMiddleware, studentCourseController.getPlacedStudents);
router.get("/placed", studentCourseController.getPlacedStudentsReport);
router.get('/placement-eligible-students-excel',authMiddleware,studentCourseController.getPlacementEligibleStudentsExcel);
router.get('/all-students-excel',authMiddleware,studentCourseController.getAllExcel);
router.get('/mentor-students-excel',authMiddleware,studentCourseController.getMentorExcel);
router.get('/placed-students-excel', authMiddleware, studentCourseController.getPlacedStudentsExcel);
router.get('/students-record/download', authMiddleware, studentCourseController.downloadAllStudentsForExcel);
router.get("/placements/download/excel", authMiddleware, downloadPlacementsExcel,);
router.get('/mentor/students', authMiddleware, studentCourseController.getAllByMentor);
router.post('/placement-details', authMiddleware, createPlacement);
router.put('/update/placements/:jobReqId', authMiddleware, updatePlacement);
router.get('/job-details', authMiddleware, getAllPlacements);
router.post('/job/view/:jobReqId', authMiddleware, markJobViewed);
router.get('/placements/:jobReqId', authMiddleware, getPlacementByJobReqId);
router.get('/company-details', authMiddleware, getUpcomingPlacements);
router.get("/placements/past", authMiddleware, getPastPlacements);
router.get('/placements/upcoming', getUpcomingPlacementsdrive);

router.post('/studentplacement', authMiddleware, createStudentPlacement);
router.get('/studentplacement/:studentId', authMiddleware, getStudentPlacementsByStudentId);

router.post('/logined', StudentRegistrationController.studentLogin);
router.post('/setup-password', StudentRegistrationController.setupPassword);
router.post('/student/reset-default-password', authMiddleware, StudentRegistrationController.resetStudentToDefaultPassword);
router.put('/studentpro/:studentId', studentAuthMiddleware, StudentRegistrationController.updateStudentProfile);
router.get('/student/:studentId', studentAuthMiddleware, StudentRegistrationController.getStudentById);
router.get('/student/profile-pic/:studentId', StudentRegistrationController.getStudentProfilePic);
router.post('/save-fcm-token', studentAuthMiddleware, StudentRegistrationController.saveFcmToken);
router.get('/student/resume/:studentId', StudentRegistrationController.getStudentResume);
router.post('/upload-profile', upload.single('profilePic'), uploadFile);
router.post('/upload-resume', upload.single('resume'), uploadFile);
router.post('/upload/offer-letter', upload.single('offerLetter'), uploadFile);
router.post("/send-login-reminder", studentCourseController.sendLoginReminder);
router.get('/download/:studentId', downloadResume);
router.get("/download/offer-letter/:studentId", downloadOfferLetter);
router.post('/resumes/download-bulk', downloadBulkResumes);
router.get('/resumes/downloadall',authMiddleware, downloadAllResumes);
router.get('/company/:companyId/download-resumes', downloadMappedStudentsResumes);
router.get('/resume/download', downloadResumes);
router.post('/resume/download', downloadResumes);

router.post('/tech', technologyController.createTechnology);
router.get('/alltech', technologyController.getTechnologies);

router.get('/placements/:jobReqId/matching-students', authMiddleware, placementController.getMatchingStudents);

// router.post("/map", mappedStudentController.createMappedStudent);
// router.get("/placement/:companyId", mappedStudentController.getMappedStudentsByCompanyId);
// router.put("/company/:id",mappedStudentController.updateMappedStudent);
// router.get("/student-notifications/:studentId", mappedStudentController.getStudentNotifications);
// router.put("/company-response/:companyId", mappedStudentController.updateStudentResponse);
// router.put('/interview-attendance/:companyId', mappedStudentController.updateInterviewAttendance);
// router.put('/:companyId/selection', authMiddleware, mappedStudentController.updateStudentSelection);
router.post('/mapped-students/map', authMiddleware, mappedStudentController.mapStudent);
router.delete('/mapped-students/:id', mappedStudentController.unmapStudent);
router.get('/history/:studentId', mappedStudentController.getStudentHistory);
router.get('/mapped-students/company/:companyId', mappedStudentController.getMappedStudentsByCompanyId);
router.get('/company/:companyId/export-excel', mappedStudentController.getMappedStudentsByCompanyIdExcel);
router.put('/mapped-students/status/:id', mappedStudentController.updateStatus);
router.put('/mapped-students/bulk-status', mappedStudentController.bulkUpdateStatus);
router.put('/mappedstudents/:mappingId/acknowledge', studentAuthMiddleware, mappedStudentController.acknowledgeMapping);
router.get('/student/mapped/:mappingId', studentOrStaffAuthMiddleware, mappedStudentController.getStudentCompanyFullDetails);
router.get('/mappedstudents/student/notifications', studentAuthMiddleware, mappedStudentController.getStudentNotifications);
router.post('/job-feedback', authMiddleware,submitJobFeedback);
router.get("/job-views/:jobReqId",authMiddleware,getJobViews);
router.get('/job-feedback/status/:jobReqId', authMiddleware,checkFeedbackStatus);
router.get("/reports/placed", authMiddleware,getPlacedStudentsReport);
router.get("/reports/awaiting",authMiddleware,getAwaitingStudentsReport);
router.get("/reports/job",authMiddleware,getJobRequirementReport);
router.get("/reports/job-requirement/details",authMiddleware,getJobRequirementDetails);
router.get("/reports/placed/details",authMiddleware,getPlacedStudentsDetails);
router.get("/reports/placedby/details",authMiddleware,getPlacedByReport);
router.get("/placements/:jobReqId/closure-summary",authMiddleware,getClosureSummary);
router.get( "/old-open-requirements",authMiddleware,getOldOpenRequirements);
router.post( "/send-escalation-mail",authMiddleware,sendEscalationMail);


router.post('/student/:studentId/approve-skills',
  studentAuthMiddleware,
  (req, res, next) => {
    req.body.updatedBy = 'student';
    next();
  },
  StudentRegistrationController.approveSkills
);

// Staff approving student's skill updates  
router.post('/students-record/:id/approve-skills',
  authMiddleware,
  (req, res, next) => {
    req.body.updatedBy = 'staff';
    next();
  },
  StudentRegistrationController.approveSkills
);

module.exports = router;
