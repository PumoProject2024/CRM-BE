const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const JobRequirementView = sequelize.define("JobRequirementView", {
  jobReqId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  emp_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  emp_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  emp_feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  branch: {
    type: DataTypes.JSON,
    allowNull: true
  },
  contact_num: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  viewedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "job_requirement_views",
  timestamps: false
});

module.exports = JobRequirementView;
