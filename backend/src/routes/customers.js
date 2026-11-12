const express = require("express");
const {
  listCustomers,
  getCustomer,
  getCustomerAppointments,
} = require("../controllers/customerController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Customer management is restricted to authenticated administrators.
router.use(requireAuth, requireAdmin);

router.get("/", listCustomers);
router.get("/:id/appointments", getCustomerAppointments);
router.get("/:id", getCustomer);

module.exports = router;
