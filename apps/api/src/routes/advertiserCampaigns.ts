import { Router } from "express";
import * as ctrl from "../controllers/advertiserCampaignController";
import { authenticateAdvertiser } from "../middleware/advertiserAuth";

const router = Router();

router.use(authenticateAdvertiser);

router.get("/ad-eligible-channels", ctrl.adEligibleChannels);
router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.delete("/:id/creatives/:creativeId", ctrl.deleteCreative);
router.patch("/:id/creatives/:creativeId", ctrl.patchCreative);
router.delete("/:id", ctrl.destroy);
router.get("/:id", ctrl.get);
router.patch("/:id", ctrl.update);
router.post("/:id/submit", ctrl.submit);
router.post("/:id/upload", ctrl.upload);

export default router;
