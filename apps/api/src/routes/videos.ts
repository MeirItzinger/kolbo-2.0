import { Router } from "express";
import { authenticate, optionalAuth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import * as videoController from "../controllers/videoController";

const router = Router();

const adminAuth = [
  authenticate,
  requireRole("SUPER_ADMIN", "CHANNEL_ADMIN", "CREATOR_ADMIN"),
];

router.get("/", optionalAuth, videoController.list);
router.get(
  "/:id/preview-playback",
  ...adminAuth,
  videoController.getAdminPreviewPlayback,
);
router.get("/:idOrSlug", optionalAuth, videoController.getByIdOrSlug);

router.post("/bulk-delete", ...adminAuth, videoController.bulkRemove);
router.post("/", ...adminAuth, videoController.create);
router.patch("/:id", ...adminAuth, videoController.update);
router.delete("/:id", ...adminAuth, videoController.remove);

router.post("/:id/publish", ...adminAuth, videoController.publish);
router.post("/:id/schedule", ...adminAuth, videoController.schedule);
router.post("/:id/duplicate", ...adminAuth, videoController.duplicate);
router.post("/:id/trailer", ...adminAuth, videoController.setTrailer);

export default router;
