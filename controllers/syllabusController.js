// controllers/syllabusController.js
const XLSX = require('xlsx');
const fs = require('fs');
const { Syllabus } = require('../models/Syllabus');

exports.uploadSyllabusExcel = async (req, res) => {
    try {
        console.log("Uploaded file path:", req.file.path); // ✅ check path

        const workbook = XLSX.readFile(req.file.path);
        console.log("Sheet names:", workbook.SheetNames); // ✅ check if Excel has any sheets

        const sheet = workbook.Sheets["CRM db"];

        console.log("Raw Sheet Data:", sheet); // ✅ log raw sheet data
        const rawData = XLSX.utils.sheet_to_json(sheet);
        console.log("Parsed JSON from Excel:", rawData); // ✅ log parsed result

        if (rawData.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Excel file is empty or improperly formatted"
            });
        }

        // Only map and insert if sheet is valid
        const jsonData = rawData.map(row => ({
            courseType: row.courseType,
            courseName: row.courseName,
            Modules: row.Modules,
            Heading: row.Heading,
            Topic: row.Topic
        }));

        await Syllabus.bulkCreate(jsonData, { validate: true });
        fs.unlinkSync(req.file.path);

        res.status(200).json({ success: true, message: 'Syllabus uploaded successfully' });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
    }
};

exports.getModules = async (req, res) => {
    try {
        const { courseType, courseName } = req.params; // Get from URL

        const modules = await Syllabus.findAll({
            attributes: ['courseType', 'courseName', 'Modules', 'Heading', 'Topic'],
            where: {
                courseType: courseType,
                courseName: courseName
            },
            order: [['courseType', 'ASC'], ['courseName', 'ASC']]
        });

        if (!modules || modules.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No modules found"
            });
        }

        const formattedData = modules.map(m => ({
            courseType: m.courseType,
            courseName: m.courseName,
            Modules: m.Modules,
            Heading: m.Heading,
            Topic: m.Topic
        }));

        res.status(200).json({
            success: true,
            message: 'Modules fetched successfully',
            data: formattedData
        });

    } catch (error) {
        console.error('Get Modules error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch modules',
            error: error.message
        });
    }
};


