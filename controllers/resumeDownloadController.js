const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const Student = require('../models/studenReg');

// Individual resume download
const downloadResume = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Find student and get resume path
    const student = await Student.findOne({
      where: { studentId },
      attributes: ["resumePath", "name", "studentId"],
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (!student.resumePath) {
      return res.status(200).json({
        success: true,
        hasResume: false,
        message: "No resume found for this student",
      });
    }

    // Construct full file path
    const filePath = path.join(__dirname, "..", student.resumePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "Resume file not found on server",
      });
    }

    // Get file extension for proper filename
    const fileExt = path.extname(filePath);
    const fileName = `${student.name}_${student.studentId}_Resume${fileExt}`;

    // Set headers for file download
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "application/octet-stream");

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("error", (error) => {
      console.error("File stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Error downloading file",
        });
      }
    });
  } catch (error) {
    console.error("Download resume error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Bulk resume download
const downloadBulkResumes = async (req, res) => {
  try {
    const { studentIds } = req.body; // Array of student IDs
    
    
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide an array of student IDs' 
      });
    }

    // Find all students with resumes
    const students = await Student.findAll({
      where: { 
        studentId: studentIds,
        resumePath: { [require('sequelize').Op.ne]: null } // Only students with resumes
      },
      attributes: ['studentId', 'resumePath', 'name']
    });

    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No resumes found for the provided student IDs' 
      });
    }

    // Set response headers for zip download
    const zipFileName = `Resumes_${Date.now()}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
    res.setHeader('Content-Type', 'application/zip');

    // Create zip archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Handle archive errors
    archive.on('error', (error) => {
      console.error('Archive error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          message: 'Error creating zip file' 
        });
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add files to archive
    const addedFiles = [];
    const notFoundFiles = [];

    for (const student of students) {
      const filePath = path.join(__dirname, '..', student.resumePath);
      
      if (fs.existsSync(filePath)) {
        const fileExt = path.extname(filePath);
        const fileName = `${student.studentId}_${student.name}_Resume${fileExt}`;
        
        archive.file(filePath, { name: fileName });
        addedFiles.push({
          studentId: student.studentId,
          name: `${student.name}`,
          fileName: fileName
        });
      } else {
        notFoundFiles.push({
          studentId: student.studentId,
          name: `${student.name} `
        });
      }
    }

    // Add a summary file to the zip
    const summaryContent = `Resume Download Summary
Generated on: ${new Date().toISOString()}

Successfully Added Files (${addedFiles.length}):
${addedFiles.map(f => `- ${f.name} (${f.studentId}) -> ${f.fileName}`).join('\n')}

${notFoundFiles.length > 0 ? `Files Not Found (${notFoundFiles.length}):
${notFoundFiles.map(f => `- ${f.name} (${f.studentId})`).join('\n')}` : 'All requested files were found and added.'}
`;

    archive.append(summaryContent, { name: 'download_summary.txt' });

    // Finalize the archive
    archive.finalize();

  } catch (error) {
    console.error('Bulk download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  }
};

// Download all resumes (for admin use)
const downloadAllResumes = async (req, res) => {
  try {
    // Find all students with resumes
    const students = await Student.findAll({
      where: { 
        resumePath: { [require('sequelize').Op.ne]: null }
      },
      attributes: ['studentId', 'resumePath', 'name']
    });

    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No resumes found in the database' 
      });
    }

    // Set response headers for zip download
    const zipFileName = `All_Resumes_${Date.now()}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
    res.setHeader('Content-Type', 'application/zip');

    // Create zip archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (error) => {
      console.error('Archive error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          message: 'Error creating zip file' 
        });
      }
    });

    archive.pipe(res);

    // Add files to archive
    const addedFiles = [];
    const notFoundFiles = [];

    for (const student of students) {
      const filePath = path.join(__dirname, '..', student.resumePath);
      
      if (fs.existsSync(filePath)) {
        const fileExt = path.extname(filePath);
        const fileName = `${student.studentId}_${student.name}_Resume${fileExt}`;
        
        archive.file(filePath, { name: fileName });
        addedFiles.push({
          studentId: student.studentId,
          name: `${student.name}`,
          fileName: fileName
        });
      } else {
        notFoundFiles.push({
          studentId: student.studentId,
          name: `${student.name}`,
        });
      }
    }

    // Add detailed summary
    const summaryContent = `All Resumes Download Summary
Generated on: ${new Date().toISOString()}
Total Students with Resume Path: ${students.length}
Successfully Downloaded: ${addedFiles.length}
Files Not Found: ${notFoundFiles.length}

Successfully Added Files:
${addedFiles.map(f => `- ${f.name} (${f.studentId}) -> ${f.fileName}`).join('\n')}

${notFoundFiles.length > 0 ? `Files Not Found:
${notFoundFiles.map(f => `- ${f.name} (${f.studentId}) `).join('\n')}` : ''}
`;

    archive.append(summaryContent, { name: 'download_summary.txt' });
    archive.finalize();

  } catch (error) {
    console.error('Download all resumes error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  }
};

module.exports = {
  downloadResume,
  downloadBulkResumes,
  downloadAllResumes
};