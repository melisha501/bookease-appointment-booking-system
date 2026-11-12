const express = require("express");
const { listSpecialists, getSpecialist, listSchedules, createSpecialist, updateSpecialist, deleteSpecialist, uploadSpecialistImage, removeSpecialistImage } = require("../controllers/catalogController");
const {
  listWorkingHours,
  getWorkingHours,
  upsertWorkingHours,
  deleteWorkingHours,
  createDateException,
  updateDateException,
  deleteDateException,
} = require("../controllers/workingHoursController");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { imageUploadMiddleware } = require("../services/uploadthingService");

const router = express.Router();
router.get("/", listSpecialists);
router.get("/schedules", listSchedules);

// Admin: working hours & schedule exceptions (provider availability). Protected.
router.get("/working-hours", requireAuth, requireAdmin, listWorkingHours);
router.get("/:id/working-hours", requireAuth, requireAdmin, getWorkingHours);
router.post("/:id/working-hours", requireAuth, requireAdmin, upsertWorkingHours);
router.put("/:id/working-hours", requireAuth, requireAdmin, upsertWorkingHours);
router.patch("/:id/working-hours", requireAuth, requireAdmin, upsertWorkingHours);
router.delete("/:id/working-hours", requireAuth, requireAdmin, deleteWorkingHours);
router.post("/:id/date-exceptions", requireAuth, requireAdmin, createDateException);
router.patch("/:id/date-exceptions/:exceptionId", requireAuth, requireAdmin, updateDateException);
router.put("/:id/date-exceptions/:exceptionId", requireAuth, requireAdmin, updateDateException);
router.delete("/:id/date-exceptions/:exceptionId", requireAuth, requireAdmin, deleteDateException);

router.get("/:id", getSpecialist);
// Admin: create/update specialist records (JSON). Protected.
router.post("/", requireAuth, requireAdmin, createSpecialist);
router.patch("/:id", requireAuth, requireAdmin, updateSpecialist);
router.put("/:id", requireAuth, requireAdmin, updateSpecialist);
router.delete("/:id", requireAuth, requireAdmin, deleteSpecialist);
// Admin: upload/update/remove specialist profile image (UploadThing). Protected endpoints.
router.post("/:id/image", requireAuth, requireAdmin, imageUploadMiddleware, uploadSpecialistImage);
router.delete("/:id/image", requireAuth, requireAdmin, removeSpecialistImage);

module.exports = router;
