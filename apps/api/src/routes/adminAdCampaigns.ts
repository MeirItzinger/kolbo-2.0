import { Router } from "express";
import * as ctrl from "../controllers/adminAdCampaignController";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();

router.use(authenticate, requireRole("SUPER_ADMIN"));

router.get("/", ctrl.list);
router.get("/:id", ctrl.get);
router.patch("/:id", ctrl.patch);
router.post("/:id/approve", ctrl.approve);
router.post("/:id/reject", ctrl.reject);

export default router;
