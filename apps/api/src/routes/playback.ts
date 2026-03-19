import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as playbackController from "../controllers/playbackController";

const router = Router();

router.get("/token/:videoId", authenticate, playbackController.getPlaybackToken);

export default router;
