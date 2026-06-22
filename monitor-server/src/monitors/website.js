const axios = require("axios");

// Simple HTTP availability + latency check.
async function websiteCheck(url) {
  const start = Date.now();
  try {
    const response = await axios.get(url, { timeout: 10000 });
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
