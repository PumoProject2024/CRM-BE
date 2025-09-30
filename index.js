const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const sequelize = require('./config/database');
const studentRegistrationRoutes = require('./routes/routes');
const authRoutes = require('./routes/authRoutes');
const compression = require('compression');

// Import seeders
const seedCourseData = require('./seeds/courseSeeder');
const seedLocationData = require('./seeds/locationSeeder');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(compression());

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    next();
});

app.use((err, req, res, next) => {
    console.error('Internal Server Error:', err);
    res.status(500).json({ message: 'Something went wrong', error: err.message });
});

// Database synchronization and seeding
const initializeDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully.');

        try {
            await sequelize.sync({ alter: false });
            console.log('All models synchronized successfully.');

            // Run seeders
            await seedCourseData();
            await seedLocationData();
            console.log('Seeding completed successfully.');

        } catch (error) {
            if (error.name === 'SequelizeUnknownConstraintError' && 
                error.constraint === 'invoices_studentId_fkey') {

                console.log('Handling constraint error, attempting to sync with force option...');
                const Invoice = require('./models/invoice');
                await Invoice.sync({ force: true });
                console.log('Invoice model re-synchronized successfully.');
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};
initializeDatabase();

// Routes
app.use('/api', studentRegistrationRoutes);
app.use('/auth', authRoutes);

app.get('/', (req, res) => {
    res.send('Student Registration API is running');
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
    });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available at http://0.0.0.0:${PORT}/api`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

module.exports = app;