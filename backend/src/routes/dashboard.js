const express = require("express");
const { getDashboardStats } = require("../controllers/dashboardController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Dashboard statistics are restricted to authenticated administrators.
router.use(requireAuth, requireAdmin);

router.get("/stats", getDashboardStats);

module.exports = router;
