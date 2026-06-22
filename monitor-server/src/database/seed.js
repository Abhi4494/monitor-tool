require("dotenv").config();

const db = require("./db");
const CheckResult = require("./models/CheckResult");

// Pass --fresh to wipe the table before seeding.
const fresh = process.argv.includes("--fresh");

const WEBSITE = process.env.WEBSITE_URL || "https://www.procurementresource.com";
const API =
  process.env.API_URL ||
  "https://adminportal-new.procurementresource.com/api/v1/checkstatus";
const BROWSER = process.env.BROWSER_URL || WEBSITE;

const MINUTE = 60 * 1000;

// minutesAgo: how long before "now" the check ran.
function at(minutesAgo) {
  return new Date(Date.now() - minutesAgo * MINUTE);
}

// A mix of healthy and failed checks so Live Status, Error Logs and Alerts
// all have something to show.
const rows = [
  // recent healthy cycle
  { name: "Main Website", type: "WEBSITE", target: WEBSITE, status: "UP", message: "Status 200 • 742ms", alerted: false, createdAt: at(1) },
  { name: "Admin API", type: "API", target: API, status: "UP", message: "HTTP 200", alerted: false, createdAt: at(1) },
  { name: "Website (Browser)", type: "BROWSER", target: BROWSER, status: "OK", message: "No client-side errors", alerted: false, createdAt: at(1) },

  // a website outage (alerted)
  { name: "Main Website", type: "WEBSITE", target: WEBSITE, status: "DOWN", message: "timeout of 10000ms exceeded", alerted: true, createdAt: at(18) },
  { name: "Admin API", type: "API", target: API, status: "UP", message: "HTTP 200", alerted: false, createdAt: at(18) },

  // an API failure (alerted)
  { name: "Admin API", type: "API", target: API, status: "DOWN", message: "Request failed with status code 502", alerted: true, createdAt: at(42) },

  // browser-only failure: client-side errors (alerted)
  {
    name: "Website (Browser)",
    type: "BROWSER",
    target: BROWSER,
    status: "FAILED",
    message: "JS: Cannot read properties of undefined (reading 'map')\nCONSOLE: Failed to load resource: 404\nCSS failed (404) /static/theme.css",
    alerted: true,
    createdAt: at(73),
  },

  // older healthy samples for history depth
  { name: "Main Website", type: "WEBSITE", target: WEBSITE, status: "UP", message: "Status 200 • 689ms", alerted: false, createdAt: at(120) },
  { name: "Admin API", type: "API", target: API, status: "UP", message: "HTTP 200", alerted: false, createdAt: at(120) },
  { name: "Website (Browser)", type: "BROWSER", target: BROWSER, status: "OK", message: "No client-side errors", alerted: false, createdAt: at(120) },
];

async function seed() {
  try {
    await db.authenticate();
    await db.sync({ alter: true }); // add any new model columns to the table

    if (fresh) {
      await CheckResult.destroy({ where: {}, truncate: true });
      console.log("Cleared check_results table (--fresh).");
    }

    await CheckResult.bulkCreate(rows, { silent: true }); // silent: keep our createdAt values
    console.log(`Seeded ${rows.length} check results.`);
    console.log(`  failures (Error Logs): ${rows.filter((r) => ["DOWN", "FAILED"].includes(r.status)).length}`);
    console.log(`  alerts  (Alerts tab) : ${rows.filter((r) => r.alerted).length}`);
  } catch (e) {
    console.error("Seed failed:", e.message);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

seed();
