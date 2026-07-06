const { chromium } = require("playwright");

// Treat a host as "ours" if it matches the monitored site's registrable
// domain (so www.example.com, example.com and api.example.com all count,
// but cdnjs.cloudflare.com / google-analytics.com etc. do not).
function baseDomain(host) {
  const parts = host.split(".");
  return parts.slice(-2).join("."); // good enough for .com/.net/.org style domains
}

function sameSite(resourceUrl, siteDomain) {
  try {
    return baseDomain(new URL(resourceUrl).hostname) === siteDomain;
  } catch {
    return false;
  }
}

// Headless browser check.
// Only flags problems with OUR OWN resources — first-party JS, CSS, pages and
// runtime errors. Third-party/CDN failures and Next.js prefetch aborts are
// ignored so we don't get false alert emails.
// Network errors that mean the MONITOR's own connection blipped (interface
// change, VPN/Wi-Fi reconnect, sleep/resume) — not a problem with the target.
// Treat them like ERR_ABORTED: ignore, never alert on them.
const MONITOR_SIDE_ERRORS = [
  "ERR_ABORTED",
  "ERR_NETWORK_CHANGED",
  "ERR_NETWORK_IO_SUSPENDED",
  "ERR_INTERNET_DISCONNECTED",
  "ERR_NAME_NOT_RESOLVED",
];

async function browserCheck(url) {
  const siteDomain = baseDomain(new URL(url).hostname);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // hardErrors → the site is genuinely broken (page won't load, server error).
  //              These flip the status to FAILED and page you.
  // warnings   → minor/noisy client-side issues (a JS console error, a 404 on
  //              one asset). Recorded for visibility but they do NOT alert.
  const hardErrors = [];
  const warnings = [];

  // JS runtime errors on our page — real, but often intermittent hydration /
  // minified-bundle noise. Record as a warning, don't page on it alone.
  page.on("pageerror", (err) => {
    warnings.push("JS: " + err.message);
  });

  // console.error output — skip the generic "Failed to load resource" lines
  // (no URL); the response handler captures those with full detail instead.
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (text.includes("Failed to load resource")) return;
      warnings.push("CONSOLE: " + text);
    }
  });

  // HTTP error responses for first-party resources. 5xx = server broken (alert);
  // 4xx = usually a missing asset, not an outage (warning only).
  page.on("response", (res) => {
    const status = res.status();
    if (status < 400 || !sameSite(res.url(), siteDomain)) return;
    const line = `HTTP ${status} ${res.request().method()} ${res.url()}`;
    (status >= 500 ? hardErrors : warnings).push(line);
  });

  // Requests that never got a response — only first-party, and ignore the
  // monitor-side network errors (see list above) which are noise.
  page.on("requestfailed", (req) => {
    const reason = req.failure() ? req.failure().errorText : "unknown";
    if (MONITOR_SIDE_ERRORS.some((code) => reason.includes(code))) return;
    if (!sameSite(req.url(), siteDomain)) return;
    hardErrors.push(`REQUEST FAILED (${reason}) ${req.url()}`);
  });

  try {
    // domcontentloaded is reliable on prefetch-heavy sites (networkidle never
    // settles); then give resources a few seconds to load and surface errors.
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: parseInt(process.env.BROWSER_TIMEOUT_MS || "30000", 10),
    });
    await page.waitForTimeout(4000);
  } catch (e) {
    // a real failure to load our own document — this IS worth alerting on
    hardErrors.push("NAV: " + e.message);
  } finally {
    await browser.close();
  }

  const all = [...hardErrors, ...warnings];
  return {
    type: "BROWSER",
    target: url,
    // FAILED only on genuine breakage; warnings alone stay OK (but are shown).
    status: hardErrors.length ? "FAILED" : "OK",
    message: all.length ? all.join("\n") : "No client-side errors",
  };
}

module.exports = browserCheck;
