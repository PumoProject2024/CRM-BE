const StudentCourse = require('../models/StudentCourse');
const MappedStudent = require('../models/Mappedstudents');
const Placement = require('../models/Placement');
const { Op } = require('sequelize');

const placementController = {
  // Get students whose skills match the placement requirements
  getMatchingStudents: async (req, res) => {
    try {
      const { placementId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const mappingFilter = req.query.mappingFilter || 'all'; // 'all', 'mapped', 'not-mapped'
      const offset = (page - 1) * limit;

      // 1. Get placement details
      const placement = await Placement.findByPk(placementId);
      if (!placement) {
        return res.status(404).json({ success: false, message: "Placement not found" });
      }

      // 2. Extract Department + skillKnown
      const placementDepartment = placement.Department?.trim();
      let placementSkills = placement.skillKnown?.split(",")
        .map(skill => skill.trim().toLowerCase())
        .filter(skill => skill && skill !== "null");

      if (!placementDepartment) {
        return res.status(400).json({
          success: false,
          message: "No department specified for this placement"
        });
      }

      // 3. Build where condition
      let whereCondition = { Department: placementDepartment };

      // Fetch ALL students (without pagination first)
      const students = await StudentCourse.findAll({
        where: whereCondition
      });

      // 4. Get mapped student IDs for this company
      const mappedStudents = await MappedStudent.findAll({
        where: {
          companyId: placementId
        },
        attributes: ['studentId']
      });

      const mappedStudentIds = new Set(mappedStudents.map(ms => ms.studentId));

      // 5. Calculate match scores and add mapping status
      const studentsWithMatchScore = students.map(student => {
        const studentData = student.toJSON();

        // Get student skills
        const studentSkills = studentData.knownSkill
          ? studentData.knownSkill.split(',')
            .map(skill => skill.trim().toLowerCase())
            .filter(skill => skill && skill !== "null")
          : [];

        // Find matched skills
        const matchedSkills = [];
        let matchCount = 0;

        if (placementSkills && placementSkills.length > 0 && studentSkills.length > 0) {
          placementSkills.forEach(placementSkill => {
            const matchedStudentSkills = studentSkills.filter(studentSkill =>
              studentSkill.includes(placementSkill) || placementSkill.includes(studentSkill)
            );

            matchedStudentSkills.forEach(matchedSkill => {
              if (!matchedSkills.includes(matchedSkill)) {
                matchedSkills.push(matchedSkill);
                matchCount++;
              }
            });
          });
        }

        // Calculate match score
        const matchScore = placementSkills && placementSkills.length > 0
          ? Math.round((matchCount / placementSkills.length) * 100)
          : 0;

        return {
          ...studentData,
          matchScore: Math.min(matchScore, 100), // cap at 100
          matchedSkills,
          totalRequiredSkills: placementSkills ? placementSkills.length : 0,
          totalMatchedSkills: matchCount,
          isMapped: mappedStudentIds.has(studentData.studentId)
        };
      });

      // 6. Sort globally (highest score first)
      studentsWithMatchScore.sort((a, b) => b.matchScore - a.matchScore);

      // 7. Apply mapping filter BEFORE pagination
      let filteredStudents = studentsWithMatchScore;
      if (mappingFilter === 'mapped') {
        filteredStudents = studentsWithMatchScore.filter(student => student.isMapped);
      } else if (mappingFilter === 'not-mapped') {
        filteredStudents = studentsWithMatchScore.filter(student => !student.isMapped);
      }

      // 8. Apply pagination AFTER filtering
      const totalFilteredStudents = filteredStudents.length;
      const totalPages = Math.ceil(totalFilteredStudents / limit);
      const paginatedStudents = filteredStudents.slice(offset, offset + limit);

      // 9. Get counts for all categories
      const allStudentsCount = studentsWithMatchScore.length;
      const mappedCount = studentsWithMatchScore.filter(s => s.isMapped).length;
      const notMappedCount = studentsWithMatchScore.filter(s => !s.isMapped).length;

      // 10. Response
      res.json({
        success: true,
        data: {
          placement: {
            id: placement.id,
            companyName: placement.companyName,
            dateOfPlacement: placement.dateOfPlacement,
            recruitmentRole: placement.recruitmentRole,
            technology: placement.technology,
            Department: placementDepartment,
            requiredSkills: placementSkills || [],
            skillKnown: placementSkills?.join(", ") || null
          },
          matchingStudents: paginatedStudents,
          pagination: {
            currentPage: page,
            totalPages,
            totalStudents: totalFilteredStudents, // This is now the filtered count
            studentsPerPage: limit,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
          },
          counts: {
            all: allStudentsCount,
            mapped: mappedCount,
            notMapped: notMappedCount
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
  },
  // Alternative method for more advanced skill matching
  getAdvancedMatchingStudents: async (req, res) => {
    try {
      const { placementId } = req.params;
      const { minMatchPercentage = 30 } = req.query; // Minimum match percentage

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const placement = await Placement.findByPk(placementId);

      if (!placement) {
        return res.status(404).json({
          success: false,
          message: 'Placement not found'
        });
      }

      // Get both skillSet and skillKnown from placement
      const placementSkillSet = placement.skillSet ?
        placement.skillSet.toLowerCase().split(',').map(skill => skill.trim()) : [];
      const placementSkillKnown = placement.skillKnown ?
        placement.skillKnown.toLowerCase().split(',').map(skill => skill.trim()) : [];

      const allPlacementSkills = [...new Set([...placementSkillSet, ...placementSkillKnown])];

      if (allPlacementSkills.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No skills specified for this placement'
        });
      }

      // Get students with course details
      const students = await StudentCourse.findAll({
        where: {
          [Op.or]: [
            { knownSkill: { [Op.not]: null } },
            { skillSet: { [Op.not]: null } }
          ]
        }
      });

      let matchingStudents = [];

      students.forEach(student => {
        const studentSkillSet = student.skillSet ?
          student.skillSet.toLowerCase().split(',').map(skill => skill.trim()) : [];
        const studentKnownSkill = student.knownSkill ?
          student.knownSkill.toLowerCase().split(',').map(skill => skill.trim()) : [];

        const allStudentSkills = [...new Set([...studentSkillSet, ...studentKnownSkill])];

        if (allStudentSkills.length === 0) return;

        // Calculate exact matches
        const exactMatches = allPlacementSkills.filter(placementSkill =>
          allStudentSkills.includes(placementSkill)
        );

        // Calculate partial matches (contains)
        const partialMatches = allPlacementSkills.filter(placementSkill =>
          allStudentSkills.some(studentSkill =>
            studentSkill.includes(placementSkill) || placementSkill.includes(studentSkill)
          ) && !exactMatches.includes(placementSkill)
        );

        const totalMatches = exactMatches.length + (partialMatches.length * 0.7); // Partial matches weighted
        const matchPercentage = (totalMatches / allPlacementSkills.length) * 100;

        if (matchPercentage >= minMatchPercentage) {
          matchingStudents.push({
            ...student.toJSON(),
            matchDetails: {
              exactMatches,
              partialMatches,
              matchPercentage: Math.round(matchPercentage),
              totalSkillsRequired: allPlacementSkills.length,
              studentSkills: allStudentSkills
            }
          });
        }
      });

      // Sort by match percentage
      matchingStudents.sort((a, b) => b.matchDetails.matchPercentage - a.matchDetails.matchPercentage);

      // Pagination logic
      const totalStudents = matchingStudents.length;
      const totalPages = Math.ceil(totalStudents / limit);
      const paginatedStudents = matchingStudents.slice(offset, offset + limit);

      res.json({
        success: true,
        data: {
          placement: {
            id: placement.id,
            companyName: placement.companyName,
            recruitmentRole: placement.recruitmentRole,
            technology: placement.technology,
            requiredSkills: allPlacementSkills,
            salary: placement.salary,
            experienceRequired: placement.experienceRequired
          },
          matchingStudents: paginatedStudents,
          pagination: {
            currentPage: page,
            totalPages: totalPages,
            totalStudents: totalStudents,
            studentsPerPage: limit,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
          },
          searchCriteria: {
            minMatchPercentage: parseInt(minMatchPercentage),
            totalMatches: totalStudents
          }
        }
      });

    } catch (error) {
      console.error('Error in advanced matching:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },
  // Get students eligible for specific placement based on multiple criteria
  getEligibleStudents: async (req, res) => {
    try {
      const { placementId } = req.params;

      const placement = await Placement.findByPk(placementId);

      if (!placement) {
        return res.status(404).json({
          success: false,
          message: 'Placement not found'
        });
      }

      // Build dynamic where clause based on placement requirements
      const whereClause = {};

      // Add skill matching
      if (placement.skillKnown) {
        const skills = placement.skillKnown.toLowerCase().split(',').map(s => s.trim());
        whereClause[Op.or] = skills.map(skill => ({
          [Op.or]: [
            { knownSkill: { [Op.iLike]: `%${skill}%` } },
            { skillSet: { [Op.iLike]: `%${skill}%` } }
          ]
        }));
      }

      // Add qualification matching if specified
      if (placement.qualification && placement.qualification !== 'Any') {
        whereClause.educationQualification = {
          [Op.iLike]: `%${placement.qualification}%`
        };
      }

      const eligibleStudents = await StudentCourse.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          placement: {
            id: placement.id,
            companyName: placement.companyName,
            recruitmentRole: placement.recruitmentRole,
            technology: placement.technology,
            qualification: placement.qualification,
            experienceRequired: placement.experienceRequired,
            salary: placement.salary
          },
          eligibleStudents,
          totalEligible: eligibleStudents.length
        }
      });

    } catch (error) {
      console.error('Error finding eligible students:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

module.exports = placementController;