const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// data: { name, type, target, status, message }
// recipients: array of emails (falls back to ALERT_TO when empty)
async function sendMail(data, recipients) {
  let to = Array.isArray(recipients) ? recipients.filter(Boolean) : [];
  if (to.length === 0 && process.env.ALERT_TO) to = [process.env.ALERT_TO];
  if (to.length === 0) {
    console.warn(`No recipients for alert "${data.name || data.type}" — skipping email.`);
    return;
  }

  await transporter.sendMail({
    from: process.env.FROM_EMAIL || process.env.MAIL_USER,
    to: to.join(","),
    subject: `🚨 Website Monitor Alert — ${data.name || data.type} ${data.status}`,
    html: `
      <h2>Problem Detected</h2>
      <p><b>Type:</b> ${data.type}</p>
      <p><b>Target:</b> ${data.target || "-"}</p>
      <p><b>Status:</b> ${data.status}</p>
      <pre style="white-space:pre-wrap">${data.message}</pre>
    `,
  });
}

module.exports = sendMail;
