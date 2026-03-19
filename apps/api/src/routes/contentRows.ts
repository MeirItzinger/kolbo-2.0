import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import * as contentRowController from "../controllers/contentRowController";

const router = Router();

const adminAuth = [
  authenticate,
  requireRole("SUPER_ADMIN", "CHANNEL_ADMIN"),
];

router.get("/", contentRowController.list);
router.get("/:id", contentRowController.getById);
router.post("/", ...adminAuth, contentRowController.create);
router.patch("/:id", ...adminAuth, contentRowController.update);
router.delete("/:id", ...adminAuth, contentRowController.remove);

export default router;
