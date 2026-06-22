const express = require("express");
const User = require("../database/models/User");
const { signToken, requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/login  { email, password } -> { token, user }
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user || !(await user.checkPassword(password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json({ token: signToken(user), user: user.toSafeJSON() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/auth/me -> current admin (validates the token)
router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(401).json({ error: "User no longer exists" });
  res.json({ user: user.toSafeJSON() });
});

// POST /api/auth/register (admin-only) -> create another admin
router.post("/register", requireAuth, async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const exists = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (exists) return res.status(409).json({ error: "Email already registered" });

    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      passwordHash: await User.hashPassword(password),
    });
    res.status(201).json({ user: user.toSafeJSON() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
