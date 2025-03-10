const express = require('express');
const StudentRegistrationController = require('../controllers/studentCon');
const employeeController = require("../controllers/employeeController");
const authMiddleware = require("../middleware/authMiddleware");
const { createInvoice } = require('../controllers/invoiceController');




const router = express.Router();

// POST route to create a new student registration
router.post('/registrations', StudentRegistrationController.createStudentRegistration);
router.post('/invoices', createInvoice);



// GET route to fetch all student registrations
router.get('/allregistrations', StudentRegistrationController.getAllStudentRegistrations);

router.put('/registrations/:id', StudentRegistrationController.updateStudentRegistration);

router.post("/register", employeeController.createEmployee); // Allow first registration without auth
router.post("/login", employeeController.loginEmployee); // Login to get JWT token
router.get("/regdetail", authMiddleware, employeeController.getEmployees); 


console.log("Student Registration Routes Loaded");

module.exports = router;

