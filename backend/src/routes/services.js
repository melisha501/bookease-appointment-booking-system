const express = require("express");
const { listServices, getService, createService, updateService, deleteService, uploadServiceImage, removeServiceImage } = require("../controllers/catalogController");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { imageUploadMiddleware } = require("../services/uploadthingService");

const router = express.Router();
router.get("/", listServices);
// Admin: create/update service records (JSON). Protected.
router.post("/", requireAuth, requireAdmin, createService);
router.get("/:id", getService);
router.patch("/:id", requireAuth, requireAdmin, updateService);
router.put("/:id", requireAuth, requireAdmin, updateService);
router.delete("/:id", requireAuth, requireAdmin, deleteService);
// Admin: upload/update/remove service image (UploadThing). Protected endpoints.
router.post("/:id/image", requireAuth, requireAdmin, imageUploadMiddleware, uploadServiceImage);
router.delete("/:id/image", requireAuth, requireAdmin, removeServiceImage);

module.exports = router;
