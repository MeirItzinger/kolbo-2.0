import { Router } from "express";
import * as ctrl from "../controllers/advertiserAuthController";
import { authenticateAdvertiser } from "../middleware/advertiserAuth";

const router = Router();

router.post("/signup", ctrl.signup);
router.post("/login", ctrl.login);
router.post("/logout", authenticateAdvertiser, ctrl.logout);
router.post("/refresh", ctrl.refresh);
router.get("/me", authenticateAdvertiser, ctrl.me);

export default router;
