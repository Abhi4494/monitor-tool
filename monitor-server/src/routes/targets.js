const express = require("express");
const Target = require("../database/models/Target");
const { requireAuth } = require("../middleware/auth");
const { runSingleCheck } = require("../scheduler");

// Fire a one-off check for a just-added/edited target so its Live Status card
// updates right away. Fire-and-forget: never block or fail the HTTP response.
function checkNow(req, target) {
  if (!target.active) return; // paused targets aren't checked
  const io = req.app.get("io");
  runSingleCheck(target, io).catch((e) =>
    console.error("Immediate check failed:", e.message)
  );
}

const router = express.Router();
const VALID_TYPES = ["WEBSITE", "API", "BROWSER"];

// Accept emails as an array or a comma/semicolon/newline separated string.
function normalizeEmails(input) {
  if (Array.isArray(input)) input = input.join(",");
  if (typeof input !== "string") return [];
  return input
    .split(/[,;\n]/)
    .map((e) => e.trim())
    .filter(Boolean);
}

function validate(body) {
  const { name, type, url } = body || {};
  if (!name || !type || !url) return "name, type and url are required";
  if (!VALID_TYPES.includes(type)) return `type must be one of ${VALID_TYPES.join(", ")}`;
  return null;
}

// All target routes require login.
router.use(requireAuth);

// GET /api/targets
router.get("/", async (req, res) => {
  const rows = await Target.findAll({ order: [["createdAt", "ASC"]] });
  res.json(rows);
});

// POST /api/targets
router.post("/", async (req, res) => {
  const err = validate(req.body);
  if (err) return res.status(400).json({ error: err });
  try {
    const target = await Target.create({
      name: req.body.name,
      type: req.body.type,
      url: req.body.url,
      emails: normalizeEmails(req.body.emails),
      active: req.body.active !== false,
    });
    res.status(201).json(target);
    checkNow(req, target); // show the new target's card immediately
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/targets/:id
router.put("/:id", async (req, res) => {
  const target = await Target.findByPk(req.params.id);
  if (!target) return res.status(404).json({ error: "Target not found" });

  const err = validate({ ...target.toJSON(), ...req.body });
  if (err) return res.status(400).json({ error: err });

  try {
    await target.update({
      name: req.body.name ?? target.name,
      type: req.body.type ?? target.type,
      url: req.body.url ?? target.url,
      emails:
        req.body.emails !== undefined
          ? normalizeEmails(req.body.emails)
          : target.emails,
      active: req.body.active !== undefined ? req.body.active : target.active,
    });
    res.json(target);
    checkNow(req, target); // refresh the card immediately after an edit
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/targets/:id
router.delete("/:id", async (req, res) => {
  const target = await Target.findByPk(req.params.id);
  if (!target) return res.status(404).json({ error: "Target not found" });
  await target.destroy();
  res.json({ ok: true });
});

module.exports = router;
