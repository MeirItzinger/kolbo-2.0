import { Router } from "express";
import { authenticate, optionalAuth } from "../middleware/auth";
import * as playbackController from "../controllers/playbackController";

const router = Router();

router.get("/token/:videoId", optionalAuth, playbackController.getPlaybackToken);
router.get("/ad/:videoId", playbackController.getPrerollAd);
router.post("/ad-view", playbackController.recordAdViewCharge);

export default router;
