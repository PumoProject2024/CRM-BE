const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
require('./models');
const sequelize = require('./config/database');
const studentRegistrationRoutes = require('./routes/routes');
const authRoutes = require('./routes/authRoutes');
const compression = require('compression');
const logger = require("./logger");
const path = require('path');
const fs = require('fs');

// Import seeders
const seedCourseData = require('./seeds/courseSeeder');
const seedLocationData = require('./seeds/locationSeeder');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ ✅ CONFIGURE UPLOADS DIRECTORY (PRODUCTION SAFE)
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "..", "uploads");

console.log('📁 Uploads directory configured at:', uploadsDir);

// ✅ ✅ ENSURE UPLOADS DIRECTORY EXISTS BEFORE MIDDLEWARE
if (!fs.existsSync(uploadsDir)) {
    console.log('⚠️ Uploads directory missing. Creating now...');
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Uploads directory created.');
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(compression());


// ✅ ✅ UPLOADS DEBUG MIDDLEWARE
app.use('/uploads', (req, res, next) => {
    const filePath = path.join(uploadsDir, req.path);

    console.log('========== FILE REQUEST DEBUG ==========');
    console.log('📂 Requested URL:', req.originalUrl);
    console.log('📍 Requested Path:', req.path);
    console.log('📁 Full File Path:', filePath);

    const exists = fs.existsSync(filePath);
    console.log('✅ File Exists:', exists);

    if (exists) {
        const stats = fs.statSync(filePath);
        console.log('📊 File Size:', stats.size, 'bytes');

        const ext = path.extname(filePath).toLowerCase();
        console.log('📝 File Extension:', ext);

        try {
            fs.accessSync(filePath, fs.constants.R_OK);
            console.log('🔓 File is readable');
        } catch (err) {
            console.log('🔒 File permission error:', err.message);
            return res.status(403).json({
                error: 'File permission denied',
                path: filePath
            });
        }
    } else {
        console.log('❌ FILE NOT FOUND');
    }

    console.log('========================================');
    next();
});


// ✅ ✅ FINAL STATIC FILE SERVING (ONLY ONE)
app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res, filepath) => {
        const ext = path.extname(filepath).toLowerCase();

        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };

        if (mimeTypes[ext]) {
            res.setHeader('Content-Type', mimeTypes[ext]);
        }

        if (ext === '.pdf') {
            res.setHeader('Content-Disposition', 'inline');
        }

        res.setHeader('Cache-Control', 'no-cache');
    }
}));


// ✅ ✅ TEST UPLOADS STATUS
app.get('/api/test-uploads', (req, res) => {
    try {
        const uploadsExists = fs.existsSync(uploadsDir);

        const profilePicsDir = path.join(uploadsDir, 'profilePics');
        const resumesDir = path.join(uploadsDir, 'resumes');

        const profilePicsExists = fs.existsSync(profilePicsDir);
        const resumesExists = fs.existsSync(resumesDir);

        let profilePics = [];
        let resumes = [];
        let resumesPdf = [];
        let resumesOther = [];

        if (profilePicsExists) {
            profilePics = fs.readdirSync(profilePicsDir);
        }

        if (resumesExists) {
            resumes = fs.readdirSync(resumesDir);
            resumesPdf = resumes.filter(f => f.toLowerCase().endsWith('.pdf'));
            resumesOther = resumes.filter(f => !f.toLowerCase().endsWith('.pdf'));
        }

        res.json({
            success: true,
            uploadsDir,
            directories: {
                uploads: uploadsExists,
                profilePics: profilePicsExists,
                resumes: resumesExists
            },
            files: {
                profilePics: profilePics.length,
                resumes: resumes.length,
                resumesPdf: resumesPdf.length,
                resumesOther: resumesOther.length,
                profilePicsList: profilePics.slice(0, 5),
                resumesPdfList: resumesPdf.slice(0, 5),
                resumesOtherList: resumesOther.slice(0, 5)
            },
            testUrls: {
                profilePic: profilePics.length > 0 ? `/uploads/profilePics/${profilePics[0]}` : null,
                resumePdf: resumesPdf.length > 0 ? `/uploads/resumes/${resumesPdf[0]}` : null,
                resumeOther: resumesOther.length > 0 ? `/uploads/resumes/${resumesOther[0]}` : null
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            uploadsDir
        });
    }
});


// ✅ ✅ DIRECT PDF TEST ROUTE
app.get('/api/test-pdf/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, 'resumes', filename);

    console.log('Direct PDF test requested:', filename);
    console.log('Full path:', filePath);

    if (!fs.existsSync(filePath)) {
        console.log('❌ PDF not found');
        return res.status(404).json({
            error: 'PDF not found',
            path: filePath,
            filename
        });
    }

    console.log('✅ PDF found, sending...');
    res.contentType('application/pdf');
    res.sendFile(filePath);
});


// ✅ ✅ REQUEST LOGGING
app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    next();
});


// ✅ ✅ DATABASE INIT
const initializeDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully.');

        try {
            await sequelize.sync({ alter: false });
            console.log('All models synchronized successfully.');

            await seedCourseData();
            await seedLocationData();
            console.log('Seeding completed successfully.');

        } catch (error) {
            if (error.name === 'SequelizeUnknownConstraintError' &&
                error.constraint === 'invoices_studentId_fkey') {

                console.log('Handling constraint error...');
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


// ✅ ✅ ROUTES
app.use('/api', studentRegistrationRoutes);
app.use('/auth', authRoutes);

app.get('/', (req, res) => {
    res.send('Student Registration API is running');
});


// ✅ ✅ GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
    logger.error({
        type: "Global Error Handler",
        message: err.message,
        stack: err.stack,
        route: req.originalUrl
    });

    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
    });
});


// ✅ ✅ START SERVER
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`✅ API: http://0.0.0.0:${PORT}/api`);
    console.log(`📁 Uploads: ${uploadsDir}`);
    console.log(`🌐 Files: http://localhost:${PORT}/uploads/`);
});


// ✅ ✅ SAFETY HANDLERS
process.on('unhandledRejection', (err) => {
    logger.error({
        type: "UNHANDLED PROMISE REJECTION",
        message: err.message,
        stack: err.stack
    });
});

process.on('uncaughtException', (err) => {
    logger.error({
        type: "UNCAUGHT EXCEPTION",
        message: err.message,
        stack: err.stack
    });
    process.exit(1);
});

module.exports = app;
