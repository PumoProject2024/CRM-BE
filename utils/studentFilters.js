const { Op, Sequelize } = require("sequelize");

const buildStudentFilters = (query) => {
    const {
        departments,
        skillsKnown,
        branches,
        companyLocations,
        experiences,
        courseTypes,
        courseNames,
        courseType,
        courseName,
        batch,
        learningMode,
        branch,
        genders,
        fromPassedYear,
        toPassedYear,
        searchField,
        searchValue
    } = query;

    const whereClause = {};

    // ✅ Department
    if (departments) {
        whereClause.Department = {
            [Op.in]: departments.split(",").map(d => d.trim())
        };
    }

    // ✅ Skills (REGEXP)
    if (skillsKnown) {
        const skillsArray = skillsKnown.split(",").map(s => s.trim().toLowerCase());

        const skillConditions = skillsArray.map(skill =>
            Sequelize.where(
                Sequelize.fn("LOWER", Sequelize.col("knownSkill")),
                {
                    [Op.regexp]: `(^|,)\\s*${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(,|$)`
                }
            )
        );

        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push(...skillConditions);
    }

    // ✅ Course filters
    if (courseTypes) {
        whereClause.courseType = {
            [Op.in]: courseTypes.split(",").map(x => x.trim())
        };
    } else if (courseType) {
        whereClause.courseType = courseType;
    }

    if (courseNames || query.courses) {
        const values = (courseNames || query.courses)
            .split(",")
            .map(x => x.trim());

        whereClause.courseName = {
            [Op.in]: values
        };
    }else if (courseName) {
        whereClause.courseName = courseName;
    }

    // ✅ Branch
    if (branches) {
        whereClause.branch = {
            [Op.in]: branches.split(",").map(x => x.trim())
        };
    } else if (branch) {
        whereClause.branch = branch;
    }

    // ✅ Gender
    if (genders) {
        whereClause.gender = {
            [Op.in]: genders.split(",").map(x => x.trim())
        };
    }

    // ✅ Experience
    if (experiences) {
        whereClause.experience = {
            [Op.in]: experiences.split(",").map(x => x.trim())
        };
    }
    if (query.readyForPlacement) {
        whereClause.readyForPlacement = query.readyForPlacement;
    }
    // ✅ Passed Year
    if (fromPassedYear || toPassedYear) {
        const fromYear = fromPassedYear;
        const toYear = toPassedYear || fromYear;

        const yearConditions = [
            {
                ugPassout: {
                    [Op.between]: [fromYear, toYear]
                }
            },
            {
                pgPassout: {
                    [Op.between]: [fromYear, toYear]
                }
            }
        ];

        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push({ [Op.or]: yearConditions });
    }

    // ✅ Desired Location
    if (companyLocations) {
        const arr = companyLocations.split(",").map(v => v.trim());

        const locConditions = [
            { desiredlocation: { [Op.iLike]: "%No Constraint%" } },
            ...arr.map(loc => ({
                desiredlocation: { [Op.iLike]: `%${loc}%` }
            }))
        ];

        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push({ [Op.or]: locConditions });
    }

    // ✅ Batch & Mode
    if (batch) whereClause.batch = batch;
    if (learningMode) whereClause.learningMode = learningMode;

    // ✅ Search
    if (searchField === "passedYear" && searchValue) {
        whereClause[Op.or] = [
            { ugPassout: { [Op.iLike]: `%${searchValue}%` } },
            { pgPassout: { [Op.iLike]: `%${searchValue}%` } }
        ];
    } else if (searchField && searchValue) {
        whereClause[searchField] = {
            [Op.iLike]: `%${searchValue}%`
        };
    }

    return whereClause;
};

module.exports = buildStudentFilters;