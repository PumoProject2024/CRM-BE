const express = require('express');
const StudentRegistrationController = require('../controllers/studentCon');
const employeeController = require("../controllers/employeeController");
const authMiddleware = require("../middleware/authMiddleware");
const studentAuthMiddleware = require('../middleware/studentAuthMiddleware');
const { createInvoice, getInvoices } = require('../controllers/invoiceController');
const { getAllCourses, createCourse, updateCourse, deleteCourse, getCourseByNameAndType, getCoursesByDepartment, } = require('../controllers/courseController');
const { getAllLocations, createLocationBranch } = require('../controllers/locationController');
const passwordController = require("../controllers/passwordController");
const studentController = require("../controllers/studentController");
const { getAllEmployeeDetails } = require("../controllers/employeeController");
const { getAllInvoices } = require('../controllers/invoiceController');
const studentCourseController = require('../controllers/studentCourseController');
const attendanceController = require('../controllers/attendanceController');
const { createPlacement, getPlacements, getUpcomingPlacements, getPastPlacements, getUpcomingPlacementsdrive, updatePlacement } = require('../controllers/placementcontrollers');
const { upload, uploadFile } = require('../controllers/uploadController');
const bulkUploadController = require('../controllers/bulkUploadController');
const syllabusController = require('../controllers/syllabusController');
const { createStudentPlacement, getStudentPlacementsByStudentId } = require('../controllers/studentPlacementController');
const { downloadResume, downloadBulkResumes, downloadAllResumes, downloadResumes } = require('../controllers/resumeDownloadController');
const technologyController = require('../controllers/technologyController');
const placementController = require('../controllers/placementController');
const mappedStudentController = require("../controllers/mappedStudentController");



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
router.get('/password/reset/:emp_id/:token', passwordController.verifyResetToken);
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
router.put('/students-record/:id',authMiddleware, studentCourseController.update);
router.get("/trainers", employeeController.getTrainerEmployees);

router.get("/placement-officer", employeeController.getPlacementOfficerNames);

 
router.post('/attendance', authMiddleware, attendanceController.createAttendance);
router.get('/attendance/:studentId', authMiddleware, attendanceController.getAttendanceByStudentId);
router.put('/attendance/:id', authMiddleware, attendanceController.updateAttendance);
router.delete('/attendance/:id/day/:day', authMiddleware, attendanceController.deleteAttendanceDay);

router.get('/placement-ready', authMiddleware, studentCourseController.getPlacementEligibleStudents);
router.get('/placedstudent', authMiddleware, studentCourseController.getPlacedStudents);
router.get('/placement-eligible-students-excel',studentCourseController.getPlacementEligibleStudentsExcel);
router.get('/placed-students-excel',studentCourseController.getPlacedStudentsExcel);
router.get('/mentor/students', authMiddleware, studentCourseController.getAllByMentor);
router.post('/placement-details', authMiddleware, createPlacement);
router.put('/update/placements/:id',authMiddleware,updatePlacement);
router.get('/company-details', authMiddleware, getUpcomingPlacements);
router.get("/placements/past", authMiddleware, getPastPlacements);
router.get('/placements/upcoming', getUpcomingPlacementsdrive);

router.post('/studentplacement', authMiddleware, createStudentPlacement);
router.get('/studentplacement/:studentId', authMiddleware, getStudentPlacementsByStudentId);

router.post('/logined', StudentRegistrationController.studentLogin);
router.post('/setup-password',StudentRegistrationController.setupPassword);
router.post('/student/reset-default-password', authMiddleware, StudentRegistrationController.resetStudentToDefaultPassword);
router.put('/studentpro/:studentId',studentAuthMiddleware, StudentRegistrationController.updateStudentProfile);
router.get('/student/:studentId', studentAuthMiddleware,StudentRegistrationController.getStudentById);
router.get('/student/profile-pic/:studentId', StudentRegistrationController.getStudentProfilePic);
router.get('/student/resume/:studentId', StudentRegistrationController.getStudentResume);
router.post('/upload-profile', upload.single('profilePic'), uploadFile);
router.post('/upload-resume', upload.single('resume'), uploadFile);

router.get('/download/:studentId', downloadResume);
router.post('/resumes/download-bulk', downloadBulkResumes);
router.get('/resumes/downloadall', downloadAllResumes);
router.get('/resume/download', downloadResumes );
router.post('/resume/download', downloadResumes );

router.post('/tech', technologyController.createTechnology);
router.get('/alltech', technologyController.getTechnologies);

router.get('/placements/:placementId/matching-students', placementController.getMatchingStudents);

router.post("/map", mappedStudentController.createMappedStudent);
router.get("/placement/:companyId", mappedStudentController.getMappedStudentsByCompanyId);
router.put("/company/:id",mappedStudentController.updateMappedStudent);
router.get("/student-notifications/:studentId", mappedStudentController.getStudentNotifications);
router.put("/company-response/:companyId", mappedStudentController.updateStudentResponse);
router.put('/interview-attendance/:companyId', mappedStudentController.updateInterviewAttendance);
router.put('/:companyId/selection', authMiddleware, mappedStudentController.updateStudentSelection);

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
