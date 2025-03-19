const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CourseDetails = sequelize.define('CourseDetails', {
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
  courseDuration: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Course duration cannot be empty" }
    }
  },
  status: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'course_details',
});

module.exports = { CourseDetails };
