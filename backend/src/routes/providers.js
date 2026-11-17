const express = require("express");
const {
  listPublicProviders,
  getPublicProvider,
  getMyProvider,
  updateMyProvider,
  uploadMyLogo,
  removeMyLogo,
  listMyServices,
  createMyService,
  updateMyService,
  deleteMyService,
  setMyServicePublish,
  uploadMyServiceImage,
  removeMyServiceImage,
  listMyAppointments,
  updateMyAppointmentStatus,
  getMyAvailability,
  updateMyAvailability,
} = require("../controllers/providerController");
const { requireAuth, requireProvider } = require("../middleware/auth");
const { imageUploadMiddleware } = require("../services/uploadthingService");

const router = express.Router();

// Public provider directory and profiles.
router.get("/", listPublicProviders);

// Authenticated provider self-service. All routes below are ownership-scoped in
// the controller, so a provider can only see/modify their own records.
router.use("/me", requireAuth, requireProvider);

router.get("/me", getMyProvider);
router.put("/me", updateMyProvider);
router.patch("/me", updateMyProvider);
router.post("/me/logo", imageUploadMiddleware, uploadMyLogo);
router.delete("/me/logo", removeMyLogo);

router.get("/me/services", listMyServices);
router.post("/me/services", createMyService);
router.patch("/me/services/:id", updateMyService);
router.put("/me/services/:id", updateMyService);
router.delete("/me/services/:id", deleteMyService);
router.patch("/me/services/:id/publish", setMyServicePublish);
router.post("/me/services/:id/image", imageUploadMiddleware, uploadMyServiceImage);
router.delete("/me/services/:id/image", removeMyServiceImage);

router.get("/me/appointments", listMyAppointments);
router.patch("/me/appointments/:reference/status", updateMyAppointmentStatus);

router.get("/me/availability", getMyAvailability);
router.put("/me/availability", updateMyAvailability);
router.patch("/me/availability", updateMyAvailability);

// Public profile route is last so "/me" is never treated as a provider id.
router.get("/:id", getPublicProvider);

module.exports = router;
