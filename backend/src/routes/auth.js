const express = require("express");
const rateLimit = require("express-rate-limit");
const { login, me } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post("/login", loginLimiter, login);
router.get("/me", requireAuth, me);

module.exports = router;
