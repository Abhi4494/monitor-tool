const axios = require("axios");

// Posts an alert to a Microsoft Teams channel via a Workflows ("Send webhook
// alerts to a channel") incoming webhook. That endpoint expects a message with
// an Adaptive Card attachment — the same shape Power Automate posts to Teams.
async function sendTeamsAlert(data) {
  const url = process.env.TEAMS_WEBHOOK_URL;
  if (!url) return; // disabled

  const recovered = ["UP", "OK"].includes(data.status);

  const card = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "Container",
              style: recovered ? "good" : "attention", // green vs red banner
              bleed: true,
              items: [
                {
                  type: "TextBlock",
                  text: `${recovered ? "✅" : "🚨"} ${data.name || data.type} is ${data.status}`,
                  weight: "Bolder",
                  size: "Large",
                  wrap: true,
                },
              ],
            },
            {
              type: "FactSet",
              facts: [
                { title: "Type", value: String(data.type) },
                { title: "Status", value: String(data.status) },
                { title: "Target", value: String(data.target || "-") },
                { title: "Time", value: new Date().toLocaleString() },
              ],
            },
            {
              type: "TextBlock",
              text: data.message || "",
              wrap: true,
              fontType: "Monospace",
              spacing: "Medium",
            },
          ],
        },
      },
    ],
  };

  await axios.post(url, card, { timeout: 8000 });
}

module.exports = sendTeamsAlert;
