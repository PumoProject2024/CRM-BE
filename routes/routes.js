const express = require('express');
const StudentRegistrationController = require('../controllers/studentCon');
const employeeController = require("../controllers/employeeController");
const authMiddleware = require("../middleware/authMiddleware");
const { createInvoice } = require('../controllers/invoiceController');
const { getAllCourses } = require('../controllers/courseController');
const { getAllLocations } = require('../controllers/locationController');

const router = express.Router();

// POST route to create a new student registration
router.get('/course', getAllCourses);
router.get('/location', getAllLocations);


router.post('/registrations', StudentRegistrationController.createStudentRegistration);
router.post('/invoices', authMiddleware,createInvoice);

// GET route to fetch all student registrations
router.get('/allregistrations',authMiddleware, StudentRegistrationController.getAllStudentRegistrations);

router.put('/registrations/:id', authMiddleware,StudentRegistrationController.updateStudentRegistration);

router.post("/register", employeeController.createEmployee); // Allow first registration without auth
router.post("/login", employeeController.loginEmployee); // Login to get JWT token
router.get("/regdetail", authMiddleware, employeeController.getEmployees); 


console.log("Student Registration Routes Loaded");

module.exports = router;

