import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import * as ctrl from "../controllers/homepageElementController";

const router = Router();

const adminAuth = [authenticate, requireRole("SUPER_ADMIN")];

router.get("/", ctrl.list);
router.get("/:id", ctrl.getById);
router.post("/", ...adminAuth, ctrl.create);
router.patch("/:id", ...adminAuth, ctrl.update);
router.delete("/:id", ...adminAuth, ctrl.remove);
router.post("/reorder", ...adminAuth, ctrl.reorder);

export default router;
