import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole, requireChannelAccess } from "../middleware/rbac";
import * as channelController from "../controllers/channelController";

const router = Router();

router.get("/", channelController.list);
router.get("/:idOrSlug", channelController.getByIdOrSlug);

router.post(
  "/",
  authenticate,
  requireRole("SUPER_ADMIN"),
  channelController.create
);

router.patch(
  "/:id",
  authenticate,
  requireChannelAccess("id"),
  channelController.update
);

router.delete(
  "/:id",
  authenticate,
  requireRole("SUPER_ADMIN"),
  channelController.remove
);

export default router;
