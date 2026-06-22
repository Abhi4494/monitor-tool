const axios = require("axios");

// API endpoint health check.
async function apiCheck(url) {
  try {
    const res = await axios.get(url, { timeout: 10000 });
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
