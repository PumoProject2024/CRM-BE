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

    // Was TEXT (unbounded). MariaDB cannot index TEXT without a key length, so this is a bounded
    // VARCHAR(512) (2048 bytes in utf8mb4, within the 3072-byte index limit). BINARY gives a
    // case-sensitive collation so uniqueness matches PostgreSQL: FCM tokens are case-sensitive.
    token: {
      type: DataTypes.STRING(512).BINARY,
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