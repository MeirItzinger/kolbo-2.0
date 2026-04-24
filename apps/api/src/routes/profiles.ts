import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as profileController from "../controllers/profileController";
import * as parentalControls from "../controllers/parentalControlsController";
import * as pinController from "../controllers/pinController";

const router = Router();

router.use(authenticate);

router.get("/", profileController.list);
router.get("/:id", profileController.get);
router.post("/", profileController.create);
router.patch("/:id", profileController.update);
router.delete("/:id", profileController.remove);

router.get("/:id/parental-controls", parentalControls.get);
router.patch(
  "/:id/parental-controls",
  pinController.requirePinGrace("parental"),
  parentalControls.update,
);

router.get("/:id/pin", pinController.getProfileStatus);
router.post("/:id/pin", pinController.setProfile);
router.post("/:id/pin/verify", pinController.verifyProfile);
router.delete("/:id/pin", pinController.clearProfile);

export default router;
