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
  viewedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "job_requirement_views",
  timestamps: false
});

module.exports = JobRequirementView;
