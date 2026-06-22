const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "targets.json");
const VALID_TYPES = ["WEBSITE", "API", "BROWSER"];

// Fallback: build a target list from the single-URL .env vars (old behaviour).
function fromEnv() {
  const list = [];
  if (process.env.WEBSITE_URL)
    list.push({ name: "Website", type: "WEBSITE", url: process.env.WEBSITE_URL });
  if (process.env.API_URL)
    list.push({ name: "API", type: "API", url: process.env.API_URL });
  if (process.env.BROWSER_URL)
    list.push({ name: "Browser", type: "BROWSER", url: process.env.BROWSER_URL });
  return list;
}

// Read targets.json fresh on every call so edits apply without a restart.
function loadTargets() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
      const valid = raw.filter(
        (t) => t && VALID_TYPES.includes(t.type) && t.url
      );
      const skipped = raw.length - valid.length;
      if (skipped > 0) {
        console.warn(`targets.json: skipped ${skipped} invalid entr(ies).`);
      }
      if (valid.length) return valid;
    }
  } catch (e) {
    console.error("targets.json is invalid, falling back to .env:", e.message);
  }
  return fromEnv();
}

module.exports = loadTargets;
