import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import * as bundleController from "../controllers/bundleController";

const router = Router();

router.get("/", bundleController.list);

router.post(
  "/",
  authenticate,
  requireRole("SUPER_ADMIN"),
  bundleController.create
);

router.patch(
  "/:id",
  authenticate,
  requireRole("SUPER_ADMIN"),
  bundleController.update
);

export default router;
