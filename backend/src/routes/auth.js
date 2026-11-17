const express = require("express");
const { register, registerProvider, login, me, logout, updateProfile } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { loginLimiter, registerLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/register", registerLimiter, register);
router.post("/register-provider", registerLimiter, registerProvider);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.put("/profile", requireAuth, updateProfile);

module.exports = router;
