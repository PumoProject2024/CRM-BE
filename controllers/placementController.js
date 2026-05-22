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
      const filterPlacementInterest = req.query.placementInterest;
      const filterMatchScore = req.query.matchScore;
      const filterGender = req.query.gender;

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
      const placementSkills = placement.skillSet
        ?.split(/,|\|\|/)
        .map(skill => skill.trim().toLowerCase())
        .filter(skill => skill && skill !== "null");

      const placementLocation = placement.jobLocation?.trim();
      const placementExperience = placement.experienceRequired?.trim();
      const placementPassedOutYear = placement.passedOutYear?.trim();
      const placementAllowedBranches = placement.allowedBranches?.trim();
      const placementGender = placement.gender?.trim();

      if (!placementDepartment) {
        return res.status(400).json({
          success: false,
          message: "No department specified for this placement"
        });
      }

      // 3. Build where condition
      let whereCondition = {};

      whereCondition.Department = filterDepartment || placementDepartment;
      whereCondition.readyForPlacement = "Yes";
      whereCondition.placementStatus = {
        [Op.in]: [
          'Awaiting for placement',
          'Placed but not accepted the Offer'
        ]
      };


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
      // ----------------------------
      // Branch Filtering (Secure Version)
      // ----------------------------

      let allowedBranchList = [];

      // Step 1: Prepare allowed branches from placement
      if (
        placementAllowedBranches &&
        placementAllowedBranches.toLowerCase() !== "all branches"
      ) {
        allowedBranchList = placementAllowedBranches
          .split(",")
          .map(b => b.trim())
          .filter(Boolean);
      }

      // Step 2: Apply branch logic
      if (allowedBranchList.length > 0) {
        // Placement has restricted branches

        if (filterBranches) {
          const manualBranches = filterBranches
            .split(",")
            .map(b => b.trim());

          const validBranches = allowedBranchList.filter(b =>
            manualBranches.includes(b)
          );

          // If intersection empty → return no results
          whereCondition.branch = {
            [Op.in]: validBranches.length > 0 ? validBranches : ["__NO_MATCH__"]
          };

        } else if (filterBranch) {
          const branch = filterBranch.trim();

          if (allowedBranchList.includes(branch)) {
            whereCondition.branch = branch;
          } else {
            // Invalid branch requested → force empty result
            whereCondition.branch = "__NO_MATCH__";
          }

        } else {
          // No manual filter → use placement restriction
          whereCondition.branch = {
            [Op.in]: allowedBranchList
          };
        }

      } else {
        // Placement allows ALL branches

        if (filterBranches) {
          whereCondition.branch = {
            [Op.in]: filterBranches.split(",").map(b => b.trim())
          };

        } else if (filterBranch) {
          whereCondition.branch = filterBranch.trim();
        }
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
      if (filterPlacementInterest) {
        const placementInterestList = filterPlacementInterest
          .split(',')
          .map(p => p.trim())
          .filter(Boolean);

        whereCondition.placementInterest = {
          [Op.in]: placementInterestList
        };
      }
      if (filterGender) {
        // Manual filter takes precedence, but must respect placement restriction
        if (!placementGender || placementGender.toLowerCase() === 'all') {
          // Placement allows all → apply manual filter directly
          whereCondition.gender = filterGender;
        } else {
          // Placement restricts gender → only allow if manual filter matches placement gender
          if (filterGender === placementGender) {
            whereCondition.gender = filterGender;
          } else {
            // Mismatch → force no results
            whereCondition.gender = '__NO_MATCH__';
          }
        }
      } else {
        // No manual filter → apply placement gender restriction if it's not 'All'/null
        if (placementGender && placementGender.toLowerCase() !== 'all') {
          whereCondition.gender = placementGender;
        }
        // else: no restriction, show all genders
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

      // 8️⃣ Mapping filter first
      let filteredStudents = studentsWithMatchScore;

      if (filterMatchScore) {
        filteredStudents = filteredStudents.filter(
          s => s.matchScore >= Number(filterMatchScore)
        );
      }

      if (mappingFilter === 'mapped') {
        filteredStudents = filteredStudents.filter(s => s.isMapped);
      } else if (mappingFilter === 'not-mapped') {
        filteredStudents = filteredStudents.filter(s => !s.isMapped);
      }

      // 9️⃣ NOW sort after filtering
      filteredStudents.sort((a, b) => {
        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore;  // 100% first
        }

        // Optional secondary sort
        return (a.studentName || "").localeCompare(b.studentName || "");
      });

      // 10. Pagination
      const totalFilteredStudents = filteredStudents.length;
      // Branch-wise count
      const branchCounts = {};

      filteredStudents.forEach(student => {
        const branch = student.branch || "Unknown";

        if (!branchCounts[branch]) {
          branchCounts[branch] = 0;
        }

        branchCounts[branch]++;
      });
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
            branchCounts,
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