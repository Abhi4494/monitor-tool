const axios = require("axios");

// Uncached (DYNAMIC) origins legitimately take a few seconds; keep the timeout
// generous so normal slowness isn't reported as an outage.
const TIMEOUT = parseInt(process.env.HTTP_TIMEOUT_MS || "20000", 10);

// API endpoint health check.
async function apiCheck(url) {
  try {
    const res = await axios.get(url, { timeout: TIMEOUT });
    return {
      type: "API",
      target: url,
      status: "UP",
      message: `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      type: "API",
      target: url,
      status: "DOWN",
      message: e.message,
    };
  }
}

module.exports = apiCheck;
