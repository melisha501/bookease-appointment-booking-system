const express = require("express");
const {
  adminListProviders,
  adminUpdateProvider,
  adminListServices,
  adminUpdateServiceApproval,
} = require("../controllers/providerController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireAdmin);

// Admin review of provider accounts and provider-submitted services.
router.get("/providers", adminListProviders);
router.patch("/providers/:id", adminUpdateProvider);
router.get("/services", adminListServices);
router.patch("/services/:id/approval", adminUpdateServiceApproval);

module.exports = router;
