const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Placement = sequelize.define('Placement', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    studentid: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    companyname: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    companylocation: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    package: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    result: {
        type: DataTypes.ENUM('Selected', 'Not Selected', 'Pending'),
        allowNull: false,
    },
    companyfeeback: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    placementofficerfeedback: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    companies: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    dateofplacement: {
        type: DataTypes.DATEONLY, // YYYY-MM-DD format
        allowNull: false,
    },
    modified_by: {
        type: DataTypes.STRING,
        allowNull: true,
    }
}, {
    tableName: 'Placements',
    timestamps: true
});

module.exports = Placement;
