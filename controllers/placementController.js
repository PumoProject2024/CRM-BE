const StudentCourse = require('../models/StudentCourse');
const MappedStudent = require('../models/Mappedstudents');
const Placement = require('../models/Placement');
const { Op } = require('sequelize');

const placementController = {
  // Get students whose skills match the placement requirements
getMatchingStudents: async (req, res) => {
  try {
    const { jobReqId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const mappingFilter = req.query.mappingFilter || 'all';

    const filterDepartment = req.query.department;
    const filterSkills = req.query.skills;
    const filterLocation = req.query.location;
    const filterExperience = req.query.experience;
    const filterCourseName = req.query.courseName;

    const filterBranches = req.query.branches;
    const filterBranch = req.query.branch;
    const fromPassedYear = req.query.fromPassedYear;
    const toPassedYear = req.query.toPassedYear;
    const studentName = req.query.studentName;

    const offset = (page - 1) * limit;

    // Extract user info from req.user (set by auth middleware)
    const { role, emp_name } = req.user;

    // 1. Get placement
    const placement = await Placement.findOne({
      where: { jobReqId }
    });

    if (!placement) {
      return res.status(404).json({ success: false, message: "Placement not found" });
    }

    // 2. Extract placement requirements
    const placementDepartment = placement.department?.trim();
    const placementSkills = placement.skillSet?.split(",")
      .map(skill => skill.trim().toLowerCase())
      .filter(skill => skill && skill !== "null");

    const placementLocation = placement.jobLocation?.trim();
    const placementExperience = placement.experienceRequired?.trim();
    const placementPassedOutYear = placement.passedOutYear?.trim();
    const placementAllowedBranches = placement.allowedBranches?.trim();

    if (!placementDepartment) {
      return res.status(400).json({
        success: false,
        message: "No department specified for this placement"
      });
    }

    // 3. Build where condition
    let whereCondition = {};

    whereCondition.Department = filterDepartment || placementDepartment;
    whereCondition.placementStatus = 'Awaiting for placement';


    // 🔥 NEW: Trainer role filtering
    if (role === 'Trainer' && emp_name) {
      // Trainer can only see students they're assigned to
      whereCondition[Op.or] = [
        { mentor: emp_name },
        { staffName1: emp_name },
        { staffName2: emp_name },
        { staffName3: emp_name }
      ];
    }
    // For other roles (super-admin, branch-head, placement-officer, etc.) - show all students

    // 🔥 NEW: Filter by allowedBranches from placement
    if (placementAllowedBranches && placementAllowedBranches.toLowerCase() !== 'all branches') {
      // Split allowedBranches by comma and trim whitespace
      const allowedBranchList = placementAllowedBranches
        .split(',')
        .map(b => b.trim())
        .filter(b => b); // Remove empty strings

      if (allowedBranchList.length > 0) {
        whereCondition.branch = {
          [Op.in]: allowedBranchList
        };
      }
    }
    // If allowedBranches is 'All Branches' or null/empty, don't add branch filter

    // Manual filter overrides (if provided in query params)
    if (filterBranches) {
      whereCondition.branch = {
        [Op.in]: filterBranches.split(",").map(b => b.trim())
      };
    } else if (filterBranch) {
      whereCondition.branch = filterBranch;
    }

    if (filterLocation) {
      whereCondition.desiredlocation = { [Op.like]: `%${filterLocation}%` };
    }

    if (filterExperience) {
      whereCondition.experience = { [Op.like]: `%${filterExperience}%` };
    }

 if (filterCourseName) {
  const courseList = filterCourseName
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);

  whereCondition.courseName = {
    [Op.in]: courseList
  };
}


    if (studentName) {
      whereCondition.studentName = {
        [Op.iLike]: `%${studentName.trim()}%`
      };
    }

    // Passed-out year filters
    if (fromPassedYear || toPassedYear) {
      const startYear = fromPassedYear;
      const endYear = toPassedYear || fromPassedYear;

      const yearConditions = [
        { ugPassout: { [Op.and]: [{ [Op.gte]: startYear }, { [Op.lte]: endYear }] } },
        { pgPassout: { [Op.and]: [{ [Op.gte]: startYear }, { [Op.lte]: endYear }] } },
        { diplomaPassout: { [Op.and]: [{ [Op.gte]: startYear }, { [Op.lte]: endYear }] } }
      ];

      if (whereCondition[Op.and]) {
        whereCondition[Op.and].push({ [Op.or]: yearConditions });
      } else {
        whereCondition[Op.and] = [{ [Op.or]: yearConditions }];
      }
    }

    // 4. Fetch students
    const students = await StudentCourse.findAll({
      where: whereCondition
    });

    // 5. Fetch mapped students WITH mappingId
    const mappedStudents = await MappedStudent.findAll({
      where: { companyId: jobReqId },
      attributes: ['id', 'studentId']
    });

    // sets and map for quick lookup
    const mappedStudentIds = new Set(mappedStudents.map(ms => ms.studentId));

    const mappedStudentMap = {};
    mappedStudents.forEach(ms => {
      mappedStudentMap[ms.studentId] = ms.id;
    });

    // 6. Skills to match
    const skillsToMatch = filterSkills
      ? filterSkills.split(",").map(skill => skill.trim().toLowerCase()).filter(Boolean)
      : placementSkills;

    // 7. Match logic + add mappingId
    const studentsWithMatchScore = students.map(student => {
      const studentData = student.toJSON();

      // normalize student skills
      const studentSkills = studentData.knownSkill
        ? studentData.knownSkill
          .split(',')
          .map(skill => skill.trim().toLowerCase())
          .filter(skill => skill && skill !== 'null')
        : [];

      // normalize required skills
      const requiredSkills = skillsToMatch
        ? skillsToMatch.map(s => s.trim().toLowerCase())
        : [];

      let matchCount = 0;
      const matchedSkills = [];

      // EXACT MATCH (no substring matching)
      requiredSkills.forEach(reqSkill => {
        if (studentSkills.includes(reqSkill)) {
          matchedSkills.push(reqSkill);
          matchCount++;
        }
      });

      const matchScore = requiredSkills.length
        ? Math.round((matchCount / requiredSkills.length) * 100)
        : 0;

      return {
        ...studentData,
        matchScore: Math.min(matchScore, 100),
        matchedSkills,
        totalRequiredSkills: requiredSkills.length,
        totalMatchedSkills: matchCount,
        isMapped: mappedStudentIds.has(studentData.studentId),
        mappingId: mappedStudentMap[studentData.studentId] || null
      };
    });

    // 8. Sort - Primary by readyForPlacement, Secondary by matchScore
    studentsWithMatchScore.sort((a, b) => {
      // Primary sort: readyForPlacement === 'Yes' comes first
      const aReady = a.readyForPlacement?.trim().toLowerCase() === 'yes' ? 1 : 0;
      const bReady = b.readyForPlacement?.trim().toLowerCase() === 'yes' ? 1 : 0;

      if (bReady !== aReady) {
        return bReady - aReady; // Students with 'Yes' come first
      }

      // Secondary sort: by matchScore (descending)
      return b.matchScore - a.matchScore;
    });

    // 9. Mapping filter
    let filteredStudents = studentsWithMatchScore;
    if (mappingFilter === 'mapped') {
      filteredStudents = filteredStudents.filter(s => s.isMapped);
    } else if (mappingFilter === 'not-mapped') {
      filteredStudents = filteredStudents.filter(s => !s.isMapped);
    }

    // 10. Pagination
    const totalFilteredStudents = filteredStudents.length;
    const totalPages = Math.ceil(totalFilteredStudents / limit);
    const paginatedStudents = filteredStudents.slice(offset, offset + limit);

    // 11. Response
    res.json({
      success: true,
      data: {
        placement,
        matchingStudents: paginatedStudents,
        pagination: {
          currentPage: page,
          totalPages,
          totalStudents: totalFilteredStudents,
          studentsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error("Error finding matching students:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}
};

module.exports = placementController;