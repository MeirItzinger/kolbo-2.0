import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import * as adminUsersController from "../controllers/adminUsersController";

const router = Router();

router.use(authenticate, requireRole("SUPER_ADMIN"));

router.get("/", adminUsersController.list);
router.get("/:id", adminUsersController.getById);
router.patch("/:id", adminUsersController.patch);
router.post("/:id/invite", adminUsersController.invite);
router.post("/:id/password-reset", adminUsersController.passwordReset);
router.post("/:id/revoke-sessions", adminUsersController.revokeSessions);

export default router;
