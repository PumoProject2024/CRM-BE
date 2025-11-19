const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const archiver = require('archiver');
const Student = require('../models/studenReg');
const StudentCourse = require('../models/StudentCourse');
const StudentRegistration = require('../models/studenReg');

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
    // --- Read same query params as main controller ---
    const {
      departments,
      skillsKnown,
      branches,
      companyLocations,
      experiences,
      resumeStatus,
      courses,
      // legacy course filters
      courseTypes,
      courseNames,
      courseType,
      courseName,
      // single filters
      batch,
      learningMode,
      branch,
      // search
      searchField,
      searchValue,
    } = req.query;

    // --- Base condition: Only students who need placement ---
    const whereClause = {
      readyForPlacement: "Yes"
    };

    // Department filter
    if (departments) {
      const departmentArray = departments.split(',').map(dept => dept.trim());
      whereClause.Department = { [Op.in]: departmentArray };
    }

    // ================================================
    // 🔥 UPDATED: Skills filter (exact match with regex)
    // ================================================
    if (skillsKnown) {
      const skillsArray = skillsKnown.split(',').map(skill => skill.trim().toLowerCase());

      const skillConditions = skillsArray.map(skill =>
        Sequelize.where(
          Sequelize.fn('LOWER', Sequelize.col('knownSkill')),
          {
            [Op.regexp]: `(^|,)\\s*${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(,|$)`
          }
        )
      );

      if (whereClause[Op.and]) {
        whereClause[Op.and].push(...skillConditions);
      } else {
        whereClause[Op.and] = skillConditions;
      }
    }

    // Legacy: course filters
    if (courses) {
      const coursesArray = courses.split(',').map(c => c.trim());
      whereClause.courseName = { [Op.in]: coursesArray };
    }

    if (!courses) {
      if (courseTypes) {
        const arr = courseTypes.split(',').map(v => v.trim());
        whereClause.courseType = { [Op.in]: arr };
      } else if (courseType) {
        whereClause.courseType = courseType;
      }

      if (courseNames) {
        const arr = courseNames.split(',').map(v => v.trim());
        whereClause.courseName = { [Op.in]: arr };
      } else if (courseName) {
        whereClause.courseName = courseName;
      }
    }

    // Branch filter
    if (branches) {
      const arr = branches.split(',').map(b => b.trim());
      whereClause.branch = { [Op.in]: arr };
    } else if (branch) {
      whereClause.branch = branch;
    }

    // ================================================
    // 🔥 UPDATED: Company location filter (with "No Constraint")
    // ================================================
    if (companyLocations) {
      const arr = companyLocations.split(',').map(v => v.trim());
      const locConditions = [
        { desiredlocation: { [Op.iLike]: '%No Constraint%' } },
        ...arr.map(loc => ({
          desiredlocation: { [Op.iLike]: `%${loc}%` }
        }))
      ];

      if (whereClause[Op.or]) {
        whereClause[Op.and] = [
          { [Op.or]: whereClause[Op.or] },
          { [Op.or]: locConditions }
        ];
      } else if (whereClause[Op.and]) {
        whereClause[Op.and].push({ [Op.or]: locConditions });
      } else {
        whereClause[Op.or] = locConditions;
      }
    }

    // Experience filter
    if (experiences) {
      const arr = experiences.split(',').map(v => v.trim());
      whereClause.experience = { [Op.in]: arr };
    }

    // Single filters
    if (batch) whereClause.batch = batch;
    if (learningMode) whereClause.learningMode = learningMode;

    // Search
    if (searchField && searchValue) {
      whereClause[searchField] = { [Op.iLike]: `%${searchValue}%` };
    }

    // Debug log
    console.log('Resume ZIP whereClause:', JSON.stringify(whereClause, null, 2));

    // ============================================
    // Custom sort function (same as other controllers)
    // ============================================
    const customSort = (a, b) => {
      // First: branch
      const branchCompare = (a.branch || '').localeCompare(b.branch || '');
      if (branchCompare !== 0) return branchCompare;

      // Second: ProgressStatus priority (Course Completed first)
      const statusA = a.ProgressStatus || '';
      const statusB = b.ProgressStatus || '';

      if (statusA === 'Course Completed' && statusB !== 'Course Completed') return -1;
      if (statusA !== 'Course Completed' && statusB === 'Course Completed') return 1;

      // Third: Alphabetical sort of status
      return statusA.localeCompare(statusB);
    };

    // --- Query StudentCourse with filters (no DB sorting) ---
    const studentCourseResults = await StudentCourse.findAll({
      where: whereClause,
      order: [] // custom sorting applied below
    });

    if (!studentCourseResults || studentCourseResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No placement-eligible students found matching the filters'
      });
    }

    // Apply custom sort
    studentCourseResults.sort(customSort);

    // Extract studentIds from course results
    const studentIds = studentCourseResults.map(r => r.studentId);

    // ================================================
    // 🔥 UPDATED: Registration filter (same as main controller)
    // ================================================
    const registrationWhereClause = {
      studentId: { [Op.in]: studentIds },
      [Op.and]: [
        {
          [Op.or]: [
            { pendingFees: { [Op.or]: [null, 0] } },
            { pendingFees: { [Op.is]: null } }
          ]
        },
        {
          [Op.or]: [
            { pendingFees2: { [Op.or]: [null, 0] } },
            { pendingFees2: { [Op.is]: null } }
          ]
        },
        {
          [Op.or]: [
            { pendingFees3: { [Op.or]: [null, 0] } },
            { pendingFees3: { [Op.is]: null } }
          ]
        },
        {
          [Op.or]: [
            { pendingFees4: { [Op.or]: [null, 0] } },
            { pendingFees4: { [Op.is]: null } }
          ]
        }
      ]
    };

    // Resume status handling (same as main controller)
    if (resumeStatus) {
      if (resumeStatus === 'uploaded') {
        registrationWhereClause.resumePath = {
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.ne]: '' }
          ]
        };
      } else if (resumeStatus === 'not_uploaded') {
        registrationWhereClause[Op.or] = [
          { resumePath: { [Op.is]: null } },
          { resumePath: '' }
        ];
      }
    }

    // Add educationCourse search filter if provided
    if (searchField === 'educationCourse' && searchValue) {
      registrationWhereClause.educationCourse = { [Op.iLike]: `%${searchValue}%` };
    }

    // Fetch registration rows matching the fees+resume filters
    const registrationData = await StudentRegistration.findAll({
      where: registrationWhereClause,
      attributes: [
        'studentId',
        'resumePath',
        'educationCourse',
        'pendingFees',
        'pendingFees2',
        'pendingFees3',
        'pendingFees4'
      ]
    });

    // Eligible student IDs after registration-level filtering
    const eligibleStudentIds = new Set(registrationData.map(r => r.studentId));

    // Filter StudentCourse rows to include only eligible students
    let filteredStudentCourseResults = studentCourseResults.filter(row => 
      eligibleStudentIds.has(row.studentId)
    );

    // ============================================
    // Re-apply custom sort after filtering
    // ============================================
    filteredStudentCourseResults.sort(customSort);

    if (filteredStudentCourseResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students found with cleared pending fees matching the filters'
      });
    }

    // Now get registration rows for those filtered students that actually have resumePath (non-empty)
    const filteredStudentIds = filteredStudentCourseResults.map(r => r.studentId);

    const studentsWithResume = await StudentRegistration.findAll({
      where: {
        studentId: { [Op.in]: filteredStudentIds },
        resumePath: { 
          [Op.and]: [
            { [Op.ne]: null }, 
            { [Op.ne]: '' }
          ] 
        }
      },
      attributes: ['studentId', 'resumePath', 'name', 'department', 'adminbranch']
    });

    if (!studentsWithResume || studentsWithResume.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No uploaded resumes found for the filtered students'
      });
    }

    // --- Prepare ZIP response headers ---
    const zipFileName = `Filtered_Resumes_${new Date().toISOString().split('T')[0]}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error creating zip file' });
      }
    });

    archive.pipe(res);

    const addedFiles = [];
    const notFoundFiles = [];

    for (const student of studentsWithResume) {
      const filePath = path.join(__dirname, '..', student.resumePath);

      if (fs.existsSync(filePath)) {
        const fileExt = path.extname(filePath);
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

    // Add summary inside zip
    const summaryContent = `Filtered Resumes Download Summary
Generated on: ${new Date().toISOString()}

Total filtered students: ${filteredStudentCourseResults.length}
Resumes added: ${addedFiles.length}
Files not found: ${notFoundFiles.length}

Added files:
${addedFiles.map(f => `- ${f.name} (${f.studentId}) -> ${f.fileName}`).join('\n')}

${notFoundFiles.length > 0 ? `Missing files:\n${notFoundFiles.map(f => `- ${f.name} (${f.studentId})`).join('\n')}` : 'All files found.'}
`;

    archive.append(summaryContent, { name: 'download_summary.txt' });

    // Finalize the archive
    await archive.finalize();

  } catch (error) {
    console.error('downloadAllResumes error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
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