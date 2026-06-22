const { DataTypes } = require("sequelize");
const db = require("../db");

// A monitored endpoint, managed from the dashboard.
const Target = db.define(
  "Target",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING, // WEBSITE | API | BROWSER
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // recipient emails for this target's alerts (array of strings).
    // MariaDB returns JSON columns as a string, so the getter normalizes
    // the value back into an array on every read.
    emails: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      get() {
        const raw = this.getDataValue("emails");
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "string" && raw.length) {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return raw
              .split(/[,;\n]/)
              .map((e) => e.trim())
              .filter(Boolean);
          }
        }
        return [];
      },
    },
    // pause monitoring without deleting
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "targets",
  }
);

module.exports = Target;
