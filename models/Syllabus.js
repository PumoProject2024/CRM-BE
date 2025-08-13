const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Syllabus = sequelize.define('Syllabus', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    courseType: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: "Course type cannot be empty" }
        }
    },
    courseName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: "Course name cannot be empty" }
        }
    },
    Modules: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Heading: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Topic: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    tableName: 'Syllabus',
    timestamps: true
});

module.exports = { Syllabus };