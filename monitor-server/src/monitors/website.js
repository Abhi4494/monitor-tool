const axios = require("axios");

// Uncached (DYNAMIC) origins legitimately take a few seconds; keep the timeout
// generous so normal slowness isn't reported as an outage.
const TIMEOUT = parseInt(process.env.HTTP_TIMEOUT_MS || "20000", 10);

// Simple HTTP availability + latency check.
async function websiteCheck(url) {
  const start = Date.now();
  try {
    const response = await axios.get(url, { timeout: TIMEOUT });
    return {
      type: "WEBSITE",
      target: url,
      status: "UP",
      message: `Status ${response.status} • ${Date.now() - start}ms`,
    };
  } catch (error) {
    return {
      type: "WEBSITE",
      target: url,
      status: "DOWN",
      message: error.message,
    };
  }
}

module.exports = websiteCheck;
