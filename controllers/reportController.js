// controllers/reportController.js

const { Op, Sequelize } = require("sequelize");
const StudentCourse = require('../models/StudentCourse');
const Placement = require('../models/Placement');
const Employee = require("../models/Employee");

// ---- MariaDB replacements for the PostgreSQL date helpers used by the reports -------------------------------------
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// First day of the month of a DATE column, as a DATETIME at 00:00:00. mysql2/Sequelize read it back as a JS Date in UTC
// (the connection timezone is +00:00), so the JSON is "YYYY-MM-01T00:00:00.000Z" - the same value the PostgreSQL
// month-truncation returned. Sorts chronologically and can be used for GROUP BY / ORDER BY.
const monthStart = (column) =>
  Sequelize.cast(Sequelize.fn("DATE_FORMAT", Sequelize.col(column), "%Y-%m-01"), "DATETIME");

// Month label such as "May 2025": three-letter English month + 4-digit year (same text as the PostgreSQL
// Mon YYYY format). ELT keeps the names English whatever the server lc_time_names is set to.
const monthLabel = (column) =>
  Sequelize.fn(
    "CONCAT",
    Sequelize.fn("ELT", Sequelize.fn("MONTH", Sequelize.col(column)), ...MONTH_ABBR),
    " ",
    Sequelize.fn("DATE_FORMAT", Sequelize.col(column), "%Y")
  );

exports.getPlacedStudentsReport = async (req, res) => {
    try {
        const {
            departments,
            branches,
            courseTypes,
            courseNames,
            placedBy,
            packageRange,
            placementStatusFilter = "All",
            placementDateFrom,
            placementDateTo
        } = req.query;

        const whereClause = {
            readyForPlacement: "Yes"
        };

        // ✅ Placement Status
        if (placementStatusFilter === "All") {
            whereClause.placementStatus = {
                [Op.in]: ["Placed", "Placed but not accepted the Offer"]
            };
        } else {
            whereClause.placementStatus = placementStatusFilter;
        }

        // ✅ Filters
        if (departments) {
            whereClause.Department = {
                [Op.in]: departments.split(",").map(v => v.trim())
            };
        }

        if (branches) {
            whereClause.branch = {
                [Op.in]: branches.split(",").map(v => v.trim())
            };
        }

        if (courseTypes) {
            whereClause.courseType = {
                [Op.in]: courseTypes.split(",").map(v => v.trim())
            };
        }

        if (courseNames) {
            whereClause.courseName = {
                [Op.in]: courseNames.split(",").map(v => v.trim())
            };
        }

        if (placedBy) {
            const placedByList = placedBy
                .split(",")
                .map(v => v.trim());

            whereClause.placedBy = {
                [Op.in]: placedByList
            };
        }

        // ✅ Package filter
        if (packageRange) {
            switch (packageRange) {
                case "<2":
                    whereClause.package = { [Op.lt]: 200000 };
                    break;
                case "2-4":
                    whereClause.package = { [Op.between]: [200000, 400000] };
                    break;
                case "4-6":
                    whereClause.package = { [Op.between]: [400000, 600000] };
                    break;
                case ">6":
                    whereClause.package = { [Op.gt]: 600000 };
                    break;
            }
        }

        // ✅ Default Last 6 Months
        const today = new Date();

        // ✅ First day of month before last 3 months

        const startDate = new Date(
            today.getFullYear(),
            today.getMonth() - 3,
            1
        );

        // ✅ Today end time

        const endDate = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            23,
            59,
            59,
            999
        );
        if (placementDateFrom && placementDateTo) {
            whereClause.placementDate = {
                [Op.between]: [startDate, endDate]
            };
        } else {
            whereClause.placementDate = {
                [Op.between]: [startDate, endDate]
            };
        }

        // ✅ MAIN QUERY (GROUP BY MONTH)
        const data = await StudentCourse.findAll({
            where: whereClause,
            attributes: [
                [monthStart("placementDate"), "month"],
                "Department",
                [Sequelize.cast(Sequelize.fn("COUNT", Sequelize.col("id")), "CHAR"), "count"]
            ],
            group: ["month", "Department"],
            order: [
                [Sequelize.literal("month"), "ASC"],
                ["Department", "ASC"]
            ]
        });

        return res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error("Error in getPlacedStudentsReport:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch placed students report",
            error: error.message
        });
    }
};

exports.getAwaitingStudentsReport = async (req, res) => {
    try {
        const {
            departments,
            branches,
            courseNames
        } = req.query;

        const whereClause = {
            readyForPlacement: "Yes",
            placementStatus: { [Op.ne]: "Placed" }
        };

        // ✅ Filters
        if (departments) {
            whereClause.Department = {
                [Op.in]: departments.split(",").map(v => v.trim())
            };
        }

        if (branches) {
            whereClause.branch = {
                [Op.in]: branches.split(",").map(v => v.trim())
            };
        }

        if (courseNames) {
            whereClause.courseName = {
                [Op.in]: courseNames.split(",").map(v => v.trim())
            };
        }

        // ✅ GROUP BY DEPARTMENT (UPDATED)
        const data = await StudentCourse.findAll({
            where: whereClause,
            attributes: [
                "Department",
                "branch",
                [Sequelize.cast(Sequelize.fn("COUNT", Sequelize.col("id")), "CHAR"), "count"]
            ],
            group: ["Department", "branch"]
        });

        return res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error("Error in getAwaitingStudentsReport:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch awaiting students report",
            error: error.message
        });
    }
};

exports.getJobRequirementReport = async (req, res) => {
    try {
        const {
            createdBy,
            department,
            createdDateFrom,
            createdDateTo
        } = req.query;

        const whereClause = {};

        // =====================================================
        // DATE FILTER
        // =====================================================

        if (createdDateFrom && createdDateTo) {
            whereClause.createdDate = {
                [Op.between]: [createdDateFrom, createdDateTo]
            };
        }

        // =====================================================
        // CREATED BY FILTER
        // =====================================================

        if (createdBy) {
            const createdByList = createdBy
                .split(",")
                .map(v => v.trim().toLowerCase());

            whereClause[Op.and] = whereClause[Op.and] || [];

            whereClause[Op.and].push(
                Sequelize.where(
                    Sequelize.fn(
                        "LOWER",
                        Sequelize.fn("TRIM", Sequelize.col("createdBy"))
                    ),
                    {
                        [Op.in]: createdByList
                    }
                )
            );
        }

        // =====================================================
        // DEPARTMENT FILTER
        // =====================================================

        if (department) {
            whereClause.department = {
                [Op.in]: department.split(",").map(v => v.trim())
            };
        }

        // =====================================================
        // MAIN QUERY
        // =====================================================

        const data = await Placement.findAll({
            where: whereClause,

            attributes: [
                [
                    monthLabel("createdDate"),
                    "month"
                ],

                // ✅ OPEN
                [
                    Sequelize.literal(`
                        CAST(COUNT(
                            CASE
                                WHEN \`jobReqStatus\` = 'Open'
                                THEN 1
                            END
                        ) AS CHAR)
                    `),
                    "Open"
                ],

                // ✅ CLOSED
                [
                    Sequelize.literal(`
                        CAST(COUNT(
                            CASE
                                WHEN \`jobReqStatus\` = 'Closed'
                                THEN 1
                            END
                        ) AS CHAR)
                    `),
                    "Closed"
                ],

                // ✅ CANCELLED
                [
                    Sequelize.literal(`
                        CAST(COUNT(
                            CASE
                                WHEN \`jobReqStatus\` = 'Cancelled'
                                THEN 1
                            END
                        ) AS CHAR)
                    `),
                    "Cancelled"
                ],

                // ✅ FREEZE
                [
                    Sequelize.literal(`
                        CAST(COUNT(
                            CASE
                                WHEN \`jobReqStatus\` = 'Freeze'
                                THEN 1
                            END
                        ) AS CHAR)
                    `),
                    "Freeze"
                ],

                // ✅ TOTAL COUNT
                [
                    Sequelize.literal(`CAST(COUNT(*) AS CHAR)`),
                    "Total"
                ]
            ],

            group: [
                monthStart("createdDate"), monthLabel("createdDate")
            ],

            order: [
                [
                    monthStart("createdDate"),
                    "ASC"
                ]
            ],

            raw: true
        });

        return res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error("Error in getJobRequirementReport:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch job requirement report",
            error: error.message
        });
    }
};

exports.getJobRequirementDetails = async (req, res) => {
    try {

        const {
            createdBy,
            departments,
            createdDateFrom,
            createdDateTo,
            month
        } = req.query;

        const whereClause = {};

        // =====================================================
        // DATE FILTER
        // =====================================================

        if (createdDateFrom && createdDateTo) {
            whereClause.createdDate = {
                [Op.between]: [createdDateFrom, createdDateTo]
            };
        }

        // =====================================================
        // MONTH FILTER
        // =====================================================

        if (month) {
            whereClause[Op.and] = whereClause[Op.and] || [];

            whereClause[Op.and].push(
                Sequelize.where(
                    Sequelize.fn("BINARY", monthLabel("createdDate")),
                    month
                )
            );
        }

        // =====================================================
        // CREATED BY FILTER
        // =====================================================

        if (createdBy) {

            const createdByList = createdBy
                .split(",")
                .map(v => v.trim().toLowerCase());

            whereClause[Op.and] = whereClause[Op.and] || [];

            whereClause[Op.and].push(
                Sequelize.where(
                    Sequelize.fn(
                        "LOWER",
                        Sequelize.fn("TRIM", Sequelize.col("createdBy"))
                    ),
                    {
                        [Op.in]: createdByList
                    }
                )
            );
        }

        // =====================================================
        // DEPARTMENT FILTER
        // =====================================================

        if (departments) {
            whereClause.department = {
                [Op.in]: departments.split(",").map(v => v.trim())
            };
        }
        whereClause.jobReqStatus = {
            [Op.in]: ["Open", "Freeze"]
        };
        // =====================================================
        // FETCH DATA
        // =====================================================

        const jobs = await Placement.findAll({
            where: whereClause,

            attributes: [
                "jobReqId",
                "companyName",
                "jobTitle",
                "department",
                "createdBy",
                "jobReqStatus",
                "createdDate"
            ],

            order: [
                ["createdDate", "ASC"]
            ],

            raw: true
        });

        // =====================================================
        // JOB AGE
        // =====================================================

        const today = new Date();

        const data = jobs.map(job => {

            let jobAge = null;

            if (
                ["Open", "Freeze"].includes(job.jobReqStatus)
            ) {

                const created = new Date(job.createdDate);

                const diffTime =
                    today.getTime() - created.getTime();

                jobAge = Math.floor(
                    diffTime / (1000 * 60 * 60 * 24)
                );
            }

            return {
                ...job,
                jobAge
            };
        });

        return res.json({
            success: true,
            count: data.length,
            data
        });

    } catch (error) {

        console.error(
            "Error in getJobRequirementDetails:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch job requirement details",
            error: error.message
        });
    }
};

exports.getPlacedStudentsDetails = async (req, res) => {
    try {

        const {
            departments,
            branches,
            courseTypes,
            courseNames,
            placedBy,
            packageRange,
            placementStatusFilter = "All",
            placementDateFrom,
            placementDateTo,
            month
        } = req.query;

        const whereClause = {
            readyForPlacement: "Yes"
        };

        // =====================================================
        // PLACEMENT STATUS
        // =====================================================

        if (placementStatusFilter === "All") {

            whereClause.placementStatus = {
                [Op.in]: [
                    "Placed",
                    "Placed but not accepted the Offer"
                ]
            };

        } else {

            whereClause.placementStatus =
                placementStatusFilter;
        }

        // =====================================================
        // DEPARTMENT FILTER
        // =====================================================

        if (departments) {

            whereClause.Department = {
                [Op.in]: departments
                    .split(",")
                    .map(v => v.trim())
            };
        }

        // =====================================================
        // BRANCH FILTER
        // =====================================================

        if (branches) {

            whereClause.branch = {
                [Op.in]: branches
                    .split(",")
                    .map(v => v.trim())
            };
        }

        // =====================================================
        // COURSE TYPE FILTER
        // =====================================================

        if (courseTypes) {

            whereClause.courseType = {
                [Op.in]: courseTypes
                    .split(",")
                    .map(v => v.trim())
            };
        }

        // =====================================================
        // COURSE NAME FILTER
        // =====================================================

        if (courseNames) {

            whereClause.courseName = {
                [Op.in]: courseNames
                    .split(",")
                    .map(v => v.trim())
            };
        }

        // =====================================================
        // PLACED BY FILTER
        // =====================================================

        if (placedBy) {

            whereClause.placedBy = {
                [Op.in]: placedBy
                    .split(",")
                    .map(v => v.trim())
            };
        }

        // =====================================================
        // PACKAGE FILTER
        // =====================================================

        if (packageRange) {

            switch (packageRange) {

                case "<2":
                    whereClause.package = {
                        [Op.lt]: 200000
                    };
                    break;

                case "2-4":
                    whereClause.package = {
                        [Op.between]: [200000, 400000]
                    };
                    break;

                case "4-6":
                    whereClause.package = {
                        [Op.between]: [400000, 600000]
                    };
                    break;

                case ">6":
                    whereClause.package = {
                        [Op.gt]: 600000
                    };
                    break;
            }
        }

        // =====================================================
        // DATE FILTER
        // =====================================================

        if (placementDateFrom && placementDateTo) {

            whereClause.placementDate = {
                [Op.between]: [
                    placementDateFrom,
                    placementDateTo
                ]
            };
        }

        // =====================================================
        // MONTH FILTER
        // =====================================================

        if (month) {

            whereClause[Op.and] =
                whereClause[Op.and] || [];

            whereClause[Op.and].push(
                Sequelize.where(
                    Sequelize.fn("BINARY", monthLabel("placementDate")),
                    month
                )
            );
        }

        // =====================================================
        // FETCH DATA
        // =====================================================

        const data = await StudentCourse.findAll({

            where: whereClause,

            attributes: [
                "studentName",
                "branch",
                "Department",
                "placedBy",
                "companyName",
                "package",
                "placementDate",
                "courseName",
                "placementStatus",
                "joiningStatus",
                "verificationRemarks",
                "placementRemarks"
            ],

            order: [
                // PostgreSQL sorts NULLs FIRST for DESC, MariaDB sorts them LAST: keep rows without a placementDate first, as before.
                [Sequelize.literal("(placementDate IS NULL)"), "DESC"],
                ["placementDate", "DESC"]
            ],

            raw: true
        });

        return res.json({
            success: true,
            count: data.length,
            data
        });

    } catch (error) {

        console.error(
            "Error in getPlacedStudentsDetails:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch placed students details",
            error: error.message
        });
    }
};

exports.getPlacedByReport = async (
    req,
    res
) => {

    try {

        const {
            departments,
            branches,
            courseTypes,
            courseNames,
            placedBy,
            packageRange,
            placementStatusFilter = "All",
            placementDateFrom,
            placementDateTo
        } = req.query;

        // =====================================================
        // FETCH ONLY PLACEMENT OFFICERS
        // =====================================================

        const placementOfficers =
            await Employee.findAll({

                where: {
                    role: "Placement officer"
                },

                attributes: ["emp_name"],

                raw: true
            });

        const placementOfficerNames =
            placementOfficers.map(
                emp => emp.emp_name
            );

        // =====================================================
        // BASE WHERE
        // =====================================================

        const whereClause = {
            readyForPlacement: "Yes"
        };

        // =====================================================
        // DEFAULT ONLY PLACEMENT OFFICERS
        // =====================================================

        whereClause.placedBy = {
            [Op.in]: placementOfficerNames
        };

        // =====================================================
        // PLACEMENT STATUS
        // =====================================================

        if (
            placementStatusFilter === "All"
        ) {

            whereClause.placementStatus = {
                [Op.in]: [
                    "Placed",
                    "Placed but not accepted the Offer"
                ]
            };

        } else {

            whereClause.placementStatus =
                placementStatusFilter;
        }

        // =====================================================
        // DEPARTMENT FILTER
        // =====================================================

        if (departments) {

            whereClause.Department = {
                [Op.in]: departments
                    .split(",")
                    .map(v => v.trim())
            };
        }

        // =====================================================
        // BRANCH FILTER
        // =====================================================

        if (branches) {

            whereClause.branch = {
                [Op.in]: branches
                    .split(",")
                    .map(v => v.trim())
            };
        }

        // =====================================================
        // COURSE TYPE FILTER
        // =====================================================

        if (courseTypes) {

            whereClause.courseType = {
                [Op.in]: courseTypes
                    .split(",")
                    .map(v => v.trim())
            };
        }

        // =====================================================
        // COURSE NAME FILTER
        // =====================================================

        if (courseNames) {

            whereClause.courseName = {
                [Op.in]: courseNames
                    .split(",")
                    .map(v => v.trim())
            };
        }

        // =====================================================
        // USER SELECTED PLACED BY
        // =====================================================

        // ✅ This overrides default placement officers

        if (placedBy) {

            const selectedPlacedBy =
                placedBy
                    .split(",")
                    .map(v => v.trim());

            whereClause.placedBy = {
                [Op.in]: selectedPlacedBy
            };
        }

        // =====================================================
        // PACKAGE FILTER
        // =====================================================

        if (packageRange) {

            switch (packageRange) {

                case "<2":

                    whereClause.package = {
                        [Op.lt]: 200000
                    };

                    break;

                case "2-4":

                    whereClause.package = {
                        [Op.between]: [
                            200000,
                            400000
                        ]
                    };

                    break;

                case "4-6":

                    whereClause.package = {
                        [Op.between]: [
                            400000,
                            600000
                        ]
                    };

                    break;

                case ">6":

                    whereClause.package = {
                        [Op.gt]: 600000
                    };

                    break;
            }
        }
        // =====================================================
        // DEFAULT LAST 4 MONTHS
        // =====================================================

        const today = new Date();

        // ✅ First day of month before last 3 months

        const startDate = new Date(
            today.getFullYear(),
            today.getMonth() - 3,
            1
        );

        // ✅ Today end time

        const endDate = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            23,
            59,
            59,
            999
        );

        // =====================================================
        // DATE FILTER
        // =====================================================

        if (
            placementDateFrom &&
            placementDateTo
        ) {

            whereClause.placementDate = {
                [Op.between]: [
                    placementDateFrom,
                    placementDateTo
                ]
            };

        } else {

            whereClause.placementDate = {
                [Op.between]: [
                    startDate,
                    endDate
                ]
            };
        }
        // =====================================================
        // MAIN QUERY
        // =====================================================

        const data =
            await StudentCourse.findAll({

                where: whereClause,

                attributes: [

                    [
                        monthLabel("placementDate"),
                        "month"
                    ],

                    "placedBy",

                    "branch",

                    [
                        Sequelize.fn(
                            "COUNT",
                            Sequelize.col("id")
                        ),
                        "count"
                    ]
                ],

                group: [

                    monthStart("placementDate"), monthLabel("placementDate"),

                    "placedBy",

                    "branch"
                ],

                order: [

                    ["placedBy", "ASC"],

                    [
                        Sequelize.col("count"),
                        "DESC"
                    ]
                ],

                raw: true
            });

        // =====================================================
        // FORMAT RESPONSE
        // =====================================================

        const formattedData = {};

        data.forEach(item => {

            const month =
                item.month || "Unknown";

            const placedByName =
                item.placedBy || "Unknown";

            const uniqueKey =
                `${month}-${placedByName}`;

            if (!formattedData[uniqueKey]) {

                formattedData[uniqueKey] = {

                    month,

                    placedBy: placedByName,

                    total: 0,

                    branches: []
                };
            }

            const count =
                Number(item.count);

            formattedData[
                uniqueKey
            ].branches.push({

                branch: item.branch,

                count
            });

            formattedData[
                uniqueKey
            ].total += count;
        });

        return res.json({

            success: true,

            data: Object.values(
                formattedData
            )
        });

    } catch (error) {

        console.error(
            "Error in getPlacedByReport:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch placed by report",

            error: error.message
        });
    }
};
