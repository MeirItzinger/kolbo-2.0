import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireChannelAccess } from "../middleware/rbac";
import * as salesController from "../controllers/salesController";

const router = Router({ mergeParams: true });

router.get(
  "/:channelId/sales",
  authenticate,
  requireChannelAccess("channelId"),
  salesController.listByChannel
);

export default router;
