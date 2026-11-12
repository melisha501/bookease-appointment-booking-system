const express = require("express");
const {
  getAvailability,
  createAppointment,
  listMine,
  cancelMine,
  listAll,
  updateStatus,
} = require("../controllers/appointmentController");
const { requireAuth, requireAdmin, optionalAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/availability", getAvailability);
router.post("/", optionalAuth, createAppointment);
router.get("/mine", requireAuth, listMine);
router.patch("/:reference/cancel", requireAuth, cancelMine);

// Admin
router.get("/", requireAuth, requireAdmin, listAll);
router.patch("/:reference/status", requireAuth, requireAdmin, updateStatus);

module.exports = router;
