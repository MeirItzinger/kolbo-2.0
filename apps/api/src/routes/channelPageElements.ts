import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import * as ctrl from "../controllers/channelPageElementController";

const router = Router({ mergeParams: true });

const adminAuth = [authenticate, requireRole("SUPER_ADMIN", "CHANNEL_ADMIN")];

router.get("/:channelId/page-elements", ctrl.list);
router.post("/:channelId/page-elements", ...adminAuth, ctrl.create);
router.patch("/:channelId/page-elements/:id", ...adminAuth, ctrl.update);
router.delete("/:channelId/page-elements/:id", ...adminAuth, ctrl.remove);
router.post("/:channelId/page-elements/reorder", ...adminAuth, ctrl.reorder);

export default router;
