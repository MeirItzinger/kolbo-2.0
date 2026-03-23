import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import * as ctrl from "../controllers/categoryController";

const router = Router({ mergeParams: true });

const adminAuth = [authenticate, requireRole("SUPER_ADMIN", "CHANNEL_ADMIN")];

router.get("/:channelId/categories", ctrl.list);
router.post("/:channelId/categories", ...adminAuth, ctrl.create);
router.patch("/:channelId/categories/:id", ...adminAuth, ctrl.update);
router.delete("/:channelId/categories/:id", ...adminAuth, ctrl.remove);
router.post("/:channelId/categories/reorder", ...adminAuth, ctrl.reorder);

export { router as categoryChannelRouter };

// Standalone public router for /categories
const publicRouter = Router();
publicRouter.get("/", ctrl.listAll);
export { publicRouter as categoryPublicRouter };

export default router;
