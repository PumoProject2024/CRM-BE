const express = require('express');
const StudentRegistrationController = require('../controllers/studentCon');
const employeeController = require("../controllers/employeeController");
const authMiddleware = require("../middleware/authMiddleware");
const { createInvoice, getInvoices } = require('../controllers/invoiceController');
const { getAllCourses,createCourse,updateCourse,deleteCourse, getCourseByNameAndType,  } = require('../controllers/courseController');
const { getAllLocations } = require('../controllers/locationController');
const passwordController = require("../controllers/passwordController");
const studentController = require("../controllers/studentController");
const { getAllEmployeeDetails } = require("../controllers/employeeController");


const router = express.Router();

// POST route to create a new student registration
router.get('/location', getAllLocations);

router.post("/student", studentController.createStudent);
router.get("/students", studentController.getAllStudents);
router.get("/students/:contactNo", studentController.getStudentByContactNo);
router.get('/bde-employees',employeeController.getBDEEmployees);



router.post('/password/forgot', passwordController.requestPasswordReset);
router.get('/password/reset/:emp_id/:token', passwordController.verifyResetToken);
router.post('/password/reset', passwordController.resetPassword);

router.post('/create-course', authMiddleware,createCourse);
router.get('/course', getAllCourses);
router.put('/courses/:id',updateCourse);
router.delete('/courses/:id',deleteCourse);
router.get('/courses/:courseName/:courseType', getCourseByNameAndType);




router.post('/registrations',authMiddleware ,StudentRegistrationController.createStudentRegistration);
router.post('/invoices', authMiddleware,createInvoice);
router.get('/invoices',getInvoices);


// GET route to fetch all student registrations
router.get('/allregistrations',authMiddleware, StudentRegistrationController.getAllStudentRegistrations);

router.put('/registrations/:studentId', authMiddleware,StudentRegistrationController.updateStudentRegistration);

router.post("/register", employeeController.createEmployee); // Allow first registration without auth
router.post("/login", employeeController.loginEmployee); // No middleware here
router.get("/regdetail", authMiddleware, employeeController.getEmployees);
router.get("/all-employees", getAllEmployeeDetails);
router.put('/regdetail/update', authMiddleware, employeeController.updateEmployeeProfile);
router.post('/changepassword', authMiddleware, employeeController.changePassword);




module.exports = router;

