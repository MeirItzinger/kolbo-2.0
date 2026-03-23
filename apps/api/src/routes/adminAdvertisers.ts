import { Router } from "express";
import * as ctrl from "../controllers/adminAdvertiserController";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();

router.use(authenticate, requireRole("SUPER_ADMIN"));

router.get("/settings", ctrl.getPlatformSettings);
router.patch("/settings", ctrl.updatePlatformSettings);
router.get("/", ctrl.listAdvertisers);
router.get("/:id", ctrl.getAdvertiser);

export default router;
