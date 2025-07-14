const express = require('express');
const StudentRegistrationController = require('../controllers/studentCon');
const employeeController = require("../controllers/employeeController");
const authMiddleware = require("../middleware/authMiddleware");
const { createInvoice, getInvoices } = require('../controllers/invoiceController');
const { getAllCourses,createCourse,updateCourse,deleteCourse, getCourseByNameAndType,  } = require('../controllers/courseController');
const { getAllLocations,createLocationBranch } = require('../controllers/locationController');
const passwordController = require("../controllers/passwordController");
const studentController = require("../controllers/studentController");
const { getAllEmployeeDetails } = require("../controllers/employeeController");
const { getAllInvoices } = require('../controllers/invoiceController');
const studentCourseController = require('../controllers/studentCourseController');
const attendanceController = require('../controllers/attendanceController');



const router = express.Router();

// POST route to create a new student registration
router.get('/location', getAllLocations);
router.post('/loc', createLocationBranch);


router.post("/student", studentController.createStudent);
router.get("/students", authMiddleware,studentController.getAllStudents);
router.put('/students/:id', authMiddleware, studentController.updateStudent);
router.get("/students/:contactNo", studentController.getStudentByContactNo);
router.get('/bde-employees',employeeController.getBDEEmployees);

router.get('/pending-details', authMiddleware, StudentRegistrationController.getPendingDetails);

router.post('/password/forgot', passwordController.requestPasswordReset);
router.get('/password/reset/:emp_id/:token', passwordController.verifyResetToken);
router.post('/password/reset', passwordController.resetPassword);
router.post("/reset-default-password", authMiddleware, passwordController.resetToDefaultPassword);


router.post('/create-course', authMiddleware,createCourse);
router.get('/course', getAllCourses);
router.put('/courses/:id',updateCourse);
router.delete('/courses/:id',deleteCourse);
router.get('/courses/:courseName/:courseType', getCourseByNameAndType);

router.post('/registrations',authMiddleware ,StudentRegistrationController.createStudentRegistration);
router.post('/invoices', authMiddleware,createInvoice);
router.get('/invoices',getInvoices);
router.get('/all-invoices',authMiddleware,getAllInvoices);


// GET route to fetch all student registrations
router.get('/allregistrations',authMiddleware, StudentRegistrationController.getAllStudentRegistrations);

router.put('/registrations/:studentId', authMiddleware,StudentRegistrationController.updateStudentRegistration);
router.put('/update/:id',authMiddleware,StudentRegistrationController.updateStudentRegistrationById);

router.post("/register", employeeController.createEmployee); // Allow first registration without auth
router.post("/login", employeeController.loginEmployee); // No middleware here
router.get("/regdetail", authMiddleware, employeeController.getEmployees);
router.get("/all-employees", authMiddleware,getAllEmployeeDetails);
router.put('/regdetail/update', authMiddleware, employeeController.updateEmployeeProfile);
router.post('/changepassword', authMiddleware, employeeController.changePassword);
router.put("/employees/:emp_id", employeeController.updateEmployeeById);
router.delete("/employees/:emp_id", employeeController.deleteEmployeeById);

router.post('/student-record', studentCourseController.create);
router.get('/students-record',authMiddleware, studentCourseController.getAll);
router.put('/students-record/:id', studentCourseController.update);
router.get("/trainers",employeeController.getTrainerEmployees);

router.post('/attendance',authMiddleware, attendanceController.createAttendance);
router.get('/attendance/:studentId', authMiddleware, attendanceController.getAttendanceByStudentId);
router.put('/attendance/:id',authMiddleware, attendanceController.updateAttendance);
router.delete('/attendance/:id/day/:day',authMiddleware, attendanceController.deleteAttendanceDay);

router.get('/placement-ready',authMiddleware ,StudentRegistrationController.getStudentsForPlacement);


module.exports = router;

