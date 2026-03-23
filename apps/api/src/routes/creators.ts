import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import * as creatorController from "../controllers/creatorController";

const router = Router();

router.get("/", creatorController.list);
router.get("/:idOrSlug", creatorController.getByIdOrSlug);

router.post(
  "/",
  authenticate,
  requireRole("SUPER_ADMIN", "CHANNEL_ADMIN"),
  creatorController.create
);

router.patch(
  "/:id",
  authenticate,
  requireRole("SUPER_ADMIN", "CHANNEL_ADMIN"),
  creatorController.update
);

router.delete(
  "/:id",
  authenticate,
  requireRole("SUPER_ADMIN", "CHANNEL_ADMIN"),
  creatorController.remove
);

router.post(
  "/:id/connect-onboarding",
  authenticate,
  requireRole("SUPER_ADMIN", "CHANNEL_ADMIN"),
  creatorController.createConnectOnboardingLink
);

export default router;
