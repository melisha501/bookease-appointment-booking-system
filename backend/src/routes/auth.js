const express = require("express");
const { register, login, me, logout, updateProfile } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.put("/profile", requireAuth, updateProfile);

module.exports = router;
