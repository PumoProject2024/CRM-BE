// controllers/reportController.js

const { Op, Sequelize } = require("sequelize");
const StudentCourse = require('../models/StudentCourse');
const Placement = require('../models/Placement');
const Employee = require("../models/Employee");

exports.getPlacedStudentsReport = async (req, res) => {
    try {
        const {
            departments,
            branches,
            courseTypes,
            courseNames,
            placedBy,
            packageRange,
            placementStatusFilter = "Placed",
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
                [Sequelize.fn("DATE_TRUNC", "month", Sequelize.col("placementDate")), "month"],
                "Department",
                [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]
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
                [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]
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
                    Sequelize.fn(
                        "TO_CHAR",
                        Sequelize.fn(
                            "DATE_TRUNC",
                            "month",
                            Sequelize.col("createdDate")
                        ),
                        "Mon YYYY"
                    ),
                    "month"
                ],

                // ✅ OPEN
                [
                    Sequelize.literal(`
                        COUNT(
                            CASE
                                WHEN "jobReqStatus" = 'Open'
                                THEN 1
                            END
                        )
                    `),
                    "Open"
                ],

                // ✅ CLOSED
                [
                    Sequelize.literal(`
                        COUNT(
                            CASE
                                WHEN "jobReqStatus" = 'Closed'
                                THEN 1
                            END
                        )
                    `),
                    "Closed"
                ],

                // ✅ CANCELLED
                [
                    Sequelize.literal(`
                        COUNT(
                            CASE
                                WHEN "jobReqStatus" = 'Cancelled'
                                THEN 1
                            END
                        )
                    `),
                    "Cancelled"
                ],

                // ✅ FREEZE
                [
                    Sequelize.literal(`
                        COUNT(
                            CASE
                                WHEN "jobReqStatus" = 'Freeze'
                                THEN 1
                            END
                        )
                    `),
                    "Freeze"
                ],

                // ✅ TOTAL COUNT
                [
                    Sequelize.literal(`
                        COUNT(*)
                    `),
                    "Total"
                ]
            ],

            group: [
                Sequelize.fn(
                    "DATE_TRUNC",
                    "month",
                    Sequelize.col("createdDate")
                )
            ],

            order: [
                [
                    Sequelize.fn(
                        "DATE_TRUNC",
                        "month",
                        Sequelize.col("createdDate")
                    ),
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
            department,
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
                    Sequelize.fn(
                        "TO_CHAR",
                        Sequelize.fn(
                            "DATE_TRUNC",
                            "month",
                            Sequelize.col("createdDate")
                        ),
                        "Mon YYYY"
                    ),
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

        if (department) {
            whereClause.department = {
                [Op.in]: department.split(",").map(v => v.trim())
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
            placementStatusFilter = "Placed",
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
                    Sequelize.fn(
                        "TO_CHAR",
                        Sequelize.fn(
                            "DATE_TRUNC",
                            "month",
                            Sequelize.col("placementDate")
                        ),
                        "Mon YYYY"
                    ),
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
                "placementDate"
            ],

            order: [
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
exports.getPlacedStudentsDetails = async (req, res) => {
    try {

        const {
            departments,
            branches,
            courseTypes,
            courseNames,
            placedBy,
            packageRange,
            placementStatusFilter = "Placed",
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
                    Sequelize.fn(
                        "TO_CHAR",
                        Sequelize.fn(
                            "DATE_TRUNC",
                            "month",
                            Sequelize.col("placementDate")
                        ),
                        "Mon YYYY"
                    ),
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
                "placementDate"
            ],

            order: [
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
            placementStatusFilter = "Placed",
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
                        Sequelize.fn(
                            "TO_CHAR",
                            Sequelize.fn(
                                "DATE_TRUNC",
                                "month",
                                Sequelize.col("placementDate")
                            ),
                            "Mon YYYY"
                        ),
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

                    Sequelize.fn(
                        "DATE_TRUNC",
                        "month",
                        Sequelize.col("placementDate")
                    ),

                    "placedBy",

                    "branch"
                ],

                order: [

                    ["placedBy", "ASC"],

                    [
                        Sequelize.literal(
                            `"count"`
                        ),
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
