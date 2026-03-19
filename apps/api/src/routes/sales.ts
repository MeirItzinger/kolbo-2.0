import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import * as salesController from "../controllers/salesController";

const router = Router();

router.get(
  "/",
  authenticate,
  requireRole("SUPER_ADMIN"),
  salesController.list
);

export default router;
