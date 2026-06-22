const fs = require("fs");
const path = require("path");
const Target = require("../database/models/Target");

const FILE = path.join(__dirname, "targets.json");
const VALID_TYPES = ["WEBSITE", "API", "BROWSER"];

// On first boot (empty targets table), import the legacy targets.json so the
// dashboard starts populated. Runs once; after that the DB is the source of truth.
async function importTargetsIfEmpty() {
  const count = await Target.count();
  if (count > 0) return;

  if (!fs.existsSync(FILE)) return;

  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    const rows = raw
      .filter((t) => t && VALID_TYPES.includes(t.type) && t.url)
      .map((t) => ({
        name: t.name || t.url,
        type: t.type,
        url: t.url,
        emails: Array.isArray(t.emails) ? t.emails : [],
        active: true,
      }));

    if (rows.length) {
      await Target.bulkCreate(rows);
      console.log(`Imported ${rows.length} targets from targets.json into the DB.`);
    }
  } catch (e) {
    console.error("Could not import targets.json:", e.message);
  }
}

module.exports = importTargetsIfEmpty;
