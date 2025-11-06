const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Technology = sequelize.define('Technology', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    Department: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    skillSet: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            notEmpty: { msg: "Skill set cannot be empty" }
        }
    },
    skillKnown: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: "Skill known cannot be empty" }
        }
    }
}, {
    tableName: 'Technology',
    timestamps: true
});

module.exports = { Technology };
