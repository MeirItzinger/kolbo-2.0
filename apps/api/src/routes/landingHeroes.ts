import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import * as landingHeroController from "../controllers/landingHeroController";

const router = Router();

const adminAuth = [
  authenticate,
  requireRole("SUPER_ADMIN", "CHANNEL_ADMIN"),
];

router.get("/", landingHeroController.list);
router.get("/:id", landingHeroController.getById);
router.post("/", ...adminAuth, landingHeroController.create);
router.patch("/:id", ...adminAuth, landingHeroController.update);
router.delete("/:id", ...adminAuth, landingHeroController.remove);

export default router;
