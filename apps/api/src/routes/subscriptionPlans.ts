import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import * as subscriptionPlanController from "../controllers/subscriptionPlanController";

const router = Router();

router.get("/", subscriptionPlanController.list);

router.post(
  "/",
  authenticate,
  requireRole("SUPER_ADMIN", "CHANNEL_ADMIN"),
  subscriptionPlanController.create
);

router.patch(
  "/:id",
  authenticate,
  requireRole("SUPER_ADMIN", "CHANNEL_ADMIN"),
  subscriptionPlanController.update
);

router.delete(
  "/:id",
  authenticate,
  requireRole("SUPER_ADMIN", "CHANNEL_ADMIN"),
  subscriptionPlanController.remove
);

router.post(
  "/bulk-delete",
  authenticate,
  requireRole("SUPER_ADMIN", "CHANNEL_ADMIN"),
  subscriptionPlanController.bulkRemove
);

export default router;
