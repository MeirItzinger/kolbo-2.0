import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import * as muxController from "../controllers/muxController";

const router = Router();

router.post(
  "/direct-upload",
  authenticate,
  requireRole("SUPER_ADMIN", "CHANNEL_ADMIN"),
  muxController.createUpload
);

export default router;
