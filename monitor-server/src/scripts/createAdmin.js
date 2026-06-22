require("dotenv").config();

const db = require("../database/db");
const User = require("../database/models/User");

// Usage: node src/scripts/createAdmin.js <email> <password> [name]
async function main() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: npm run create-admin -- <email> <password> [name]");
    process.exitCode = 1;
    return;
  }

  try {
    await db.authenticate();
    await db.sync({ alter: true });

    const normalized = email.toLowerCase().trim();
    const existing = await User.findOne({ where: { email: normalized } });
    if (existing) {
      console.error(`An admin with email ${normalized} already exists.`);
      process.exitCode = 1;
      return;
    }

    const user = await User.create({
      name: name || null,
      email: normalized,
      passwordHash: await User.hashPassword(password),
    });
    console.log(`Admin created: ${user.email} (id ${user.id})`);
  } catch (e) {
    console.error("Failed to create admin:", e.message);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

main();
