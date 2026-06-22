const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const db = require("../db");

// Admin users who can log in and manage targets.
const User = db.define(
  "User",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "users",
  }
);

// Helpers
User.hashPassword = (plain) => bcrypt.hash(plain, 10);

User.prototype.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Never leak the hash to the client.
User.prototype.toSafeJSON = function () {
  return { id: this.id, name: this.name, email: this.email };
};

module.exports = User;
