import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as watchSessionController from "../controllers/watchSessionController";

const router = Router();

router.post("/heartbeat", authenticate, watchSessionController.heartbeat);
router.post("/end", authenticate, watchSessionController.end);

export default router;
