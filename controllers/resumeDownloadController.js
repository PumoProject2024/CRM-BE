const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
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
        message: 'Please provide an array of student IDs',
      });
    }

    // 🔍 Fetch students with resume paths
    const students = await Student.findAll({
      where: {
        studentId: studentIds,
        resumePath: { [Op.ne]: null },
      },
      attributes: ['studentId', 'resumePath', 'name', 'department', 'adminbranch'],
    });

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No resumes found for the provided student IDs',
      });
    }

    // 🗂️ Zip setup
    const zipFileName = `Selected_Resumes_${new Date().toISOString().split('T')[0]}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (error) => {
      console.error('Archive error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error creating zip file',
        });
      }
    });

    archive.pipe(res);

    const addedFiles = [];
    const notFoundFiles = [];

    // 🧠 Add student resumes
    for (const student of students) {
      const filePath = path.join(__dirname, '..', student.resumePath);

      if (fs.existsSync(filePath)) {
        const fileExt = path.extname(filePath);

        // 🧩 Safe naming with fallback + cleanup
        const safeName = (student.name || 'student').replace(/[^\w\s]/gi, '_');
        const safeDept = (student.department || 'Dept').replace(/[^\w\s]/gi, '_');
        const safeBranch = (student.adminbranch || 'Branch').replace(/[^\w\s]/gi, '_');

        // 📄 Final filename (same as single resume)
        const fileName = `${safeName}_${safeDept}_${safeBranch}_resume${fileExt}`;

        archive.file(filePath, { name: fileName });

        addedFiles.push({
          studentId: student.studentId,
          name: student.name,
          fileName,
        });
      } else {
        notFoundFiles.push({
          studentId: student.studentId,
          name: student.name,
        });
      }
    }

    // 📝 Summary file inside ZIP
    const summaryContent = `Resume Download Summary
Generated on: ${new Date().toISOString()}

✅ Successfully Added Files (${addedFiles.length}):
${addedFiles.map(f => `- ${f.name} (${f.studentId}) -> ${f.fileName}`).join('\n')}

${notFoundFiles.length > 0
        ? `❌ Files Not Found (${notFoundFiles.length}):
${notFoundFiles.map(f => `- ${f.name} (${f.studentId})`).join('\n')}`
        : 'All requested files were found and added.'}
`;

    archive.append(summaryContent, { name: 'download_summary.txt' });

    // 📦 Finalize
    archive.finalize();

  } catch (error) {
    console.error('Bulk download error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
};
// Download all resumes (for admin use)
const downloadAllResumes = async (req, res) => {
  try {
    // 🔍 Find all students with resumes
    const students = await Student.findAll({
      where: { 
        resumePath: { [Op.ne]: null }
      },
      attributes: ['studentId', 'resumePath', 'name', 'department', 'adminbranch']
    });

    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No resumes found in the database' 
      });
    }

    // 🗂️ Set response headers
    const zipFileName = `All_Resumes_${new Date().toISOString().split('T')[0]}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
    res.setHeader('Content-Type', 'application/zip');

    // Create ZIP
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

    const addedFiles = [];
    const notFoundFiles = [];

    // 🧠 Add each resume file to ZIP
    for (const student of students) {
      const filePath = path.join(__dirname, '..', student.resumePath);
      
      if (fs.existsSync(filePath)) {
        const fileExt = path.extname(filePath);

        // 🧩 Clean and format filename
        const safeName = (student.name || 'student').replace(/[^\w\s]/gi, '_');
        const safeDept = (student.department || 'Dept').replace(/[^\w\s]/gi, '_');
        const safeBranch = (student.adminbranch || 'Branch').replace(/[^\w\s]/gi, '_');

        const fileName = `${safeName}_${safeDept}_${safeBranch}_resume${fileExt}`;

        archive.file(filePath, { name: fileName });
        addedFiles.push({
          studentId: student.studentId,
          name: student.name,
          fileName
        });
      } else {
        notFoundFiles.push({
          studentId: student.studentId,
          name: student.name
        });
      }
    }

    // 📝 Add summary file
    const summaryContent = `All Resumes Download Summary
Generated on: ${new Date().toISOString()}

Total Students with Resume Path: ${students.length}
Successfully Downloaded: ${addedFiles.length}
Files Not Found: ${notFoundFiles.length}

✅ Successfully Added Files:
${addedFiles.map(f => `- ${f.name} (${f.studentId}) -> ${f.fileName}`).join('\n')}

${notFoundFiles.length > 0
  ? `❌ Files Not Found:
${notFoundFiles.map(f => `- ${f.name} (${f.studentId})`).join('\n')}`
  : 'All requested files were found and added.'}
`;

    archive.append(summaryContent, { name: 'download_summary.txt' });

    // 📦 Finalize ZIP
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
// Updated unified controller for resume downloads
const downloadResumes = async (req, res) => {
  try {
    const { studentIds } = req.body; // Array of student IDs for bulk download
    const {
      // Filters for filtered download
      courseTypes,
      courseNames,
      branches,
      companyLocations,
      experiences,
      searchField,
      searchValue
    } = req.query;

    let students = [];
    let downloadType = '';

    // Determine download type based on request
    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      // Bulk download - specific student IDs
      downloadType = 'bulk';
      students = await Student.findAll({
        where: { 
          studentId: studentIds,
          resumePath: { [require('sequelize').Op.ne]: null }
        },
        attributes: ['studentId', 'resumePath', 'name']
      });
    } else {
      // Filtered download - based on filters
      downloadType = 'filtered';
      
      // Build where clause for filtered download
      const whereClause = {
        placementneeded: 'Yes',
        ProgressStatus: 'Course Completed',
        resumePath: { [require('sequelize').Op.ne]: null }
      };

      // Apply filters
      if (courseTypes) {
        const courseTypeArray = courseTypes.split(',').map(type => type.trim());
        whereClause.courseType = { [require('sequelize').Op.in]: courseTypeArray };
      }

      if (courseNames) {
        const courseNameArray = courseNames.split(',').map(name => name.trim());
        whereClause.courseName = { [require('sequelize').Op.in]: courseNameArray };
      }

      if (branches) {
        const branchArray = branches.split(',').map(branch => branch.trim());
        whereClause.branch = { [require('sequelize').Op.in]: branchArray };
      }

      if (companyLocations) {
        const locationArray = companyLocations.split(',').map(location => location.trim());
        if (locationArray.length > 0) {
          const locationConditions = [
            { desiredlocation: { [require('sequelize').Op.iLike]: '%No Constraint%' } },
            ...locationArray.map(location => ({
              desiredlocation: { [require('sequelize').Op.iLike]: `%${location}%` }
            }))
          ];
          whereClause[require('sequelize').Op.or] = locationConditions;
        }
      }

      if (experiences) {
        const experienceArray = experiences.split(',').map(exp => exp.trim());
        whereClause.experience = { [require('sequelize').Op.in]: experienceArray };
      }

      // Search functionality
      if (searchField && searchValue) {
        whereClause[searchField] = { [require('sequelize').Op.iLike]: `%${searchValue}%` };
      }

      students = await Student.findAll({
        where: whereClause,
        attributes: ['studentId', 'resumePath', 'name']
      });
    }

    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: downloadType === 'bulk' 
          ? 'No resumes found for the selected students' 
          : 'No resumes found matching the current filters'
      });
    }

    // Set response headers for zip download
    const zipFileName = downloadType === 'bulk' 
      ? `Selected_Resumes_${Date.now()}.zip`
      : `Filtered_Resumes_${Date.now()}.zip`;
      
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
          name: student.name,
          fileName: fileName
        });
      } else {
        notFoundFiles.push({
          studentId: student.studentId,
          name: student.name
        });
      }
    }

    // Add a summary file to the zip
    const summaryContent = `Resume Download Summary
Generated on: ${new Date().toISOString()}
Download Type: ${downloadType === 'bulk' ? 'Selected Students' : 'Filtered Results'}

Successfully Added Files (${addedFiles.length}):
${addedFiles.map(f => `- ${f.name} (${f.studentId}) -> ${f.fileName}`).join('\n')}

${notFoundFiles.length > 0 ? `Files Not Found (${notFoundFiles.length}):
${notFoundFiles.map(f => `- ${f.name} (${f.studentId})`).join('\n')}` : 'All requested files were found and added.'}

${downloadType === 'filtered' ? `Applied Filters:
${courseTypes ? `- Course Types: ${courseTypes}` : ''}
${courseNames ? `- Course Names: ${courseNames}` : ''}
${branches ? `- Branches: ${branches}` : ''}
${companyLocations ? `- Company Locations: ${companyLocations}` : ''}
${experiences ? `- Experience Levels: ${experiences}` : ''}
${searchField && searchValue ? `- Search: ${searchField} contains "${searchValue}"` : ''}` : ''}
`;

    archive.append(summaryContent, { name: 'download_summary.txt' });

    // Finalize the archive
    archive.finalize();

  } catch (error) {
    console.error('Resume download error:', error);
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
  downloadAllResumes,
  downloadResumes
};