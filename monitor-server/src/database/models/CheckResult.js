const { DataTypes } = require("sequelize");
const db = require("../db");

// One row per individual check run (website / api / browser).
const CheckResult = db.define(
  "CheckResult",
  {
    name: {
      type: DataTypes.STRING, // friendly label, e.g. "Main Website"
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING, // WEBSITE | API | BROWSER
      allowNull: false,
    },
    target: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING, // UP | DOWN | OK | FAILED
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // true when this result triggered an email alert
    alerted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "check_results",
    indexes: [{ fields: ["status"] }, { fields: ["type"] }],
  }
);

module.exports = CheckResult;
