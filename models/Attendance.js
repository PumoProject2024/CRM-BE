const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Attendance = sequelize.define("Attendance", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    studentId: {  // Changed from student_id to studentId
        type: DataTypes.STRING,
        allowNull: false,
    },
    month: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 12
        }
    },
    year: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 2020,
            max: 2050
        }
    },
    // Days 1-31 as JSON fields storing attendance data
    day_1: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_2: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_3: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_4: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_5: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_6: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_7: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_8: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_9: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_10: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_11: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_12: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_13: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_14: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_15: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_16: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_17: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_18: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_19: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_20: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_21: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_22: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_23: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_24: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_25: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_26: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_27: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_28: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_29: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_30: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    day_31: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    created_by: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    modified_by: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    tableName: 'attendances',
    timestamps: true, // This will add createdAt and updatedAt
    indexes: [
        {
            unique: true,
            fields: ['studentId', 'month', 'year']  // Changed from student_id to studentId
        },
        {
            fields: ['month', 'year']
        },
        {
            fields: ['studentId']  // Changed from student_id to studentId
        }
    ]
});

module.exports = Attendance;