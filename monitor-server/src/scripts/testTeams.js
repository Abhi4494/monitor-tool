require("dotenv").config();

const sendTeamsAlert = require("../services/teams");

// Sends one sample alert card to TEAMS_WEBHOOK_URL so you can confirm the
// Teams integration works without waiting for a real outage.
async function main() {
  if (!process.env.TEAMS_WEBHOOK_URL) {
    console.error("TEAMS_WEBHOOK_URL is not set in .env — nothing to test.");
    process.exitCode = 1;
    return;
  }

  try {
    await sendTeamsAlert({
      name: "Test Alert",
      type: "WEBSITE",
      target: "https://example.com",
      status: "DOWN",
      message: "This is a TEST notification from website-monitor. If you can see this in Teams, the integration works. ✅",
    });
    console.log("Test card POSTed. Check your Teams channel.");
  } catch (e) {
    console.error("Teams test failed:", e.message);
    if (e.response) {
      console.error("HTTP status:", e.response.status);
      console.error("Response body:", JSON.stringify(e.response.data));
    }
    process.exitCode = 1;
  }
}

main();
