import { Router } from "express";
import * as stripeController from "../controllers/stripeController";
import * as muxController from "../controllers/muxController";

const router = Router();

router.post("/stripe", stripeController.handleWebhook);
router.post("/mux", muxController.handleWebhook);

export default router;
