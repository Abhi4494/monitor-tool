const cron = require("node-cron");
const axios = require("axios");

const websiteCheck = require("./monitors/website");
const apiCheck = require("./monitors/api");
const browserCheck = require("./monitors/browser");
const sendMail = require("./services/email");
const sendTeamsAlert = require("./services/teams");
const CheckResult = require("./database/models/CheckResult");
const Target = require("./database/models/Target");

const FAILURE_STATUSES = ["DOWN", "FAILED"];

// Maps each target type to its checker function.
const CHECKERS = {
  WEBSITE: websiteCheck,
  API: apiCheck,
  BROWSER: browserCheck,
};

// Run every active target once, persist + broadcast each result,
// and alert that target's own recipients on failure.
async function runChecks(io) {
  const targets = await Target.findAll({ where: { active: true } });

  const results = await Promise.all(
    targets.map(async (t) => {
      const checker = CHECKERS[t.type];
      let result;
      try {
        result = await checker(t.url);
      } catch (e) {
        result = {
          type: t.type,
          target: t.url,
          status: "DOWN",
          message: "Check threw: " + e.message,
        };
      }
      result.name = t.name || t.url; // friendly label for the dashboard
      result.emails = Array.isArray(t.emails) ? t.emails : []; // per-target recipients
      return result;
    })
  );

  for (const result of results) {
    const isFailure = FAILURE_STATUSES.includes(result.status);

    // on failure: alert this target's email recipients (or .env fallback)
    // AND post to the Teams channel (if configured)
    if (isFailure) {
      try {
        await sendMail(result, result.emails);
        result.alerted = true;
      } catch (e) {
        console.error("Email alert failed:", e.message);
      }
      try {
        await sendTeamsAlert(result);
      } catch (e) {
        console.error("Teams alert failed:", e.message);
      }
    }

    // persist
    let saved;
    try {
      saved = await CheckResult.create(result);
    } catch (e) {
      console.error("DB save failed:", e.message);
    }

    // broadcast live status to connected dashboards (without recipient emails)
    const { emails, ...clean } = result;
    const payload = saved ? saved.toJSON() : { ...clean, createdAt: new Date() };
    io.emit("check:result", payload);
    if (isFailure) io.emit("check:alert", payload);

    console.log(`[${result.name || result.type}] ${result.status} — ${result.message.split("\n")[0]}`);
  }

  io.emit("check:cycle", { at: new Date(), count: results.length });

  // Heartbeat / dead-man's-switch: reaching here means the cron fired, the DB
  // was reachable, and all checks ran. Ping the external watcher so it knows
  // the monitor itself is alive. If WE go down, the ping stops and the watcher
  // (e.g. Healthchecks.io) alerts you. Fire-and-forget; never block a cycle.
  if (process.env.HEARTBEAT_URL) {
    axios
      .get(process.env.HEARTBEAT_URL, { timeout: 5000 })
      .catch((e) => console.error("Heartbeat ping failed:", e.message));
  }
}

function startScheduler(io) {
  const expression = process.env.CHECK_CRON || "*/5 * * * *";

  // run once on boot so the dashboard isn't empty
  runChecks(io).catch((e) => console.error("Initial check failed:", e.message));

  cron.schedule(expression, () => {
    runChecks(io).catch((e) => console.error("Scheduled check failed:", e.message));
  });

  console.log("Scheduler started:", expression);
}

module.exports = { startScheduler, runChecks };
