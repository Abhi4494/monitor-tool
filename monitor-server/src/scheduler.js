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

// --- Anti-flap settings (override in .env) --------------------------------
// How many times to CONFIRM a failure before trusting it. The internet has
// tiny blips constantly; re-checking a couple of times means a single slow
// response no longer pages you.
const RETRIES = parseInt(process.env.CHECK_RETRIES || "3", 10);
// Pause between confirmation attempts.
const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS || "3000", 10);
// Run the heavy headless-browser checks only every Nth cycle. Launching a full
// Chromium every minute overloaded the monitor's own machine and made the HTTP
// checks time out — which looked like "everything went down at the same second".
const BROWSER_EVERY = parseInt(process.env.BROWSER_EVERY || "5", 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let cycle = 0; // counts cron ticks, used to throttle the browser checks

// Run one target's checker, but CONFIRM a failure before trusting it: re-run up
// to RETRIES times and accept the first non-failure result. Only if EVERY
// attempt fails do we return a failure. This is what stops single transient
// blips (one slow response, a momentary network hiccup) from raising an alert.
async function runChecker(t) {
  const checker = CHECKERS[t.type];
  let result;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
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
    if (!FAILURE_STATUSES.includes(result.status)) break; // confirmed healthy
    if (attempt < RETRIES) {
      console.log(`[${t.name || t.url}] attempt ${attempt}/${RETRIES} failed — re-checking…`);
      await sleep(RETRY_DELAY_MS);
    }
  }
  result.name = t.name || t.url; // friendly label for the dashboard
  result.emails = Array.isArray(t.emails) ? t.emails : []; // per-target recipients
  return result;
}

// Run every active target once, persist + broadcast each result,
// and alert that target's own recipients on failure.
async function runChecks(io) {
  const targets = await Target.findAll({ where: { active: true } });
  cycle++;

  // Light HTTP checks (WEBSITE/API) are cheap — run them together.
  const light = targets.filter((t) => t.type !== "BROWSER");
  // Heavy checks (BROWSER) launch a full Chromium — expensive on CPU/memory.
  const heavy = targets.filter((t) => t.type === "BROWSER");
  const runHeavy = heavy.length > 0 && (cycle === 1 || cycle % BROWSER_EVERY === 0);

  const results = await Promise.all(light.map(runChecker));

  // Run browser checks AFTER the HTTP checks and one-at-a-time, so Chromium
  // never competes with the HTTP checks for CPU (that competition was the main
  // cause of correlated "all down at once" false alarms). Throttled to every
  // BROWSER_EVERY-th cycle to keep the monitor host's load down.
  if (runHeavy) {
    for (const t of heavy) {
      results.push(await runChecker(t));
    }
  } else if (heavy.length) {
    console.log(`Skipping ${heavy.length} browser check(s) this cycle (runs every ${BROWSER_EVERY}).`);
  }

  for (const result of results) {
    const isFailure = FAILURE_STATUSES.includes(result.status);

    // Look up this target's previous status to detect a state CHANGE.
    // We notify only on transitions (UP->DOWN and DOWN->UP), not on every
    // cycle — so no repeated spam while down, and you get a recovery alert.
    let previous;
    try {
      previous = await CheckResult.findOne({
        where: { type: result.type, target: result.target },
        order: [["id", "DESC"]], // id is monotonic; safe even within the same second
      });
    } catch (e) {
      console.error("Previous-status lookup failed:", e.message);
    }
    const wasFailure = previous ? FAILURE_STATUSES.includes(previous.status) : false;

    const justWentDown = isFailure && !wasFailure; // includes first-ever check that's down
    const justRecovered = !isFailure && wasFailure;

    // Send notifications only on a transition.
    if (justWentDown || justRecovered) {
      try {
        await sendMail(result, result.emails);
        if (justWentDown) result.alerted = true; // "Alerts" tab = failures we paged on
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
    if (justWentDown) io.emit("check:alert", payload);

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

// Check ONE target right now and broadcast it — used when a target is added or
// edited from the dashboard, so its card appears immediately instead of after
// the next cron cycle. Persists + broadcasts only; alerting stays with the
// regular cycle so adding a target never fires an email on its own.
async function runSingleCheck(target, io) {
  const result = await runChecker(target);
  let saved;
  try {
    saved = await CheckResult.create(result);
  } catch (e) {
    console.error("DB save failed (immediate check):", e.message);
  }
  const { emails, ...clean } = result;
  const payload = saved ? saved.toJSON() : { ...clean, createdAt: new Date() };
  if (io) io.emit("check:result", payload);
  console.log(`[${result.name || result.type}] (immediate) ${result.status}`);
  return payload;
}

function startScheduler(io) {
  const expression = process.env.CHECK_CRON || "*/5 * * * *";

  // Re-entrancy guard: with retries + longer timeouts a cycle can occasionally
  // run past the next tick. Skip the new tick instead of piling cycles on top of
  // each other (which would starve the host and cause the very timeouts we fixed).
  let running = false;
  const tick = async (label) => {
    if (running) {
      console.warn("Previous cycle still running — skipping this tick.");
      return;
    }
    running = true;
    try {
      await runChecks(io);
    } catch (e) {
      console.error(`${label} failed:`, e.message);
    } finally {
      running = false;
    }
  };

  // run once on boot so the dashboard isn't empty
  tick("Initial check");

  cron.schedule(expression, () => tick("Scheduled check"));

  console.log("Scheduler started:", expression);
}

module.exports = { startScheduler, runChecks, runSingleCheck };
