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
async function browserCheck(url) {
  const siteDomain = baseDomain(new URL(url).hostname);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];

  // JS runtime errors on our page (always first-party).
  page.on("pageerror", (err) => {
    errors.push("JS: " + err.message);
  });

  // console.error output — skip the generic "Failed to load resource" lines
  // (no URL); the response handler captures those with full detail instead.
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (text.includes("Failed to load resource")) return;
      errors.push("CONSOLE: " + text);
    }
  });

  // HTTP error responses (4xx/5xx) — only for first-party resources.
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 400 && sameSite(res.url(), siteDomain)) {
      errors.push(`HTTP ${status} ${res.request().method()} ${res.url()}`);
    }
  });

  // Requests that never got a response — only first-party, and ignore
  // ERR_ABORTED (Next.js prefetch cancellations, navigations) which are noise.
  page.on("requestfailed", (req) => {
    const reason = req.failure() ? req.failure().errorText : "unknown";
    if (reason.includes("ERR_ABORTED")) return;
    if (!sameSite(req.url(), siteDomain)) return;
    errors.push(`REQUEST FAILED (${reason}) ${req.url()}`);
  });

  try {
    // domcontentloaded is reliable on prefetch-heavy sites (networkidle never
    // settles); then give resources a few seconds to load and surface errors.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000);
  } catch (e) {
    // a real failure to load our own document — this IS worth alerting on
    errors.push("NAV: " + e.message);
  } finally {
    await browser.close();
  }

  return {
    type: "BROWSER",
    target: url,
    status: errors.length ? "FAILED" : "OK",
    message: errors.length ? errors.join("\n") : "No client-side errors",
  };
}

module.exports = browserCheck;
