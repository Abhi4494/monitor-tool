const express = require("express");
const { Op } = require("sequelize");
const CheckResult = require("../database/models/CheckResult");

const router = express.Router();

const FAILURE_STATUSES = ["DOWN", "FAILED"];

// Latest result per check type — powers the "Live Status" cards on first load.
router.get("/status", async (req, res) => {
  try {
    const rows = await CheckResult.findAll({
      order: [["createdAt", "DESC"]],
      limit: 300,
    });

    // latest result per distinct target (type + url)
    const latest = {};
    for (const row of rows) {
      const key = `${row.type}::${row.target}`;
      if (!latest[key]) latest[key] = row;
    }

    res.json(Object.values(latest));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Recent results (optionally filter by type) — raw history feed.
router.get("/results", async (req, res) => {
  try {
    const where = {};
    if (req.query.type) where.type = req.query.type;

    const rows = await CheckResult.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: Math.min(Number(req.query.limit) || 100, 500),
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Error logs — only failed checks (DOWN / FAILED).
router.get("/logs", async (req, res) => {
  try {
    const rows = await CheckResult.findAll({
      where: { status: { [Op.in]: FAILURE_STATUSES } },
      order: [["createdAt", "DESC"]],
      limit: Math.min(Number(req.query.limit) || 100, 500),
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Alerts — failed checks that actually triggered an email.
router.get("/alerts", async (req, res) => {
  try {
    const rows = await CheckResult.findAll({
      where: { alerted: true },
      order: [["createdAt", "DESC"]],
      limit: Math.min(Number(req.query.limit) || 100, 500),
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
