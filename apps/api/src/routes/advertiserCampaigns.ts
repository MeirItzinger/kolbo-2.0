import { Router } from "express";
import * as ctrl from "../controllers/advertiserCampaignController";
import { authenticateAdvertiser } from "../middleware/advertiserAuth";

const router = Router();

router.use(authenticateAdvertiser);

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.get("/:id", ctrl.get);
router.patch("/:id", ctrl.update);
router.post("/:id/submit", ctrl.submit);
router.post("/:id/upload", ctrl.upload);

export default router;
