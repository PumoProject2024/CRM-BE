const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StudentDeviceToken = sequelize.define(
  "StudentDeviceToken",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    studentId: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    token: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },

    deviceType: {
      type: DataTypes.STRING,
      allowNull: true,
    }

  },
  {
    tableName: "student_device_tokens",
    timestamps: true
  }
);

module.exports = StudentDeviceToken;