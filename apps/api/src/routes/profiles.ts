import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as profileController from "../controllers/profileController";
import * as parentalControls from "../controllers/parentalControlsController";

const router = Router();

router.use(authenticate);

router.get("/", profileController.list);
router.get("/:id", profileController.get);
router.post("/", profileController.create);
router.patch("/:id", profileController.update);
router.delete("/:id", profileController.remove);

router.get("/:id/parental-controls", parentalControls.get);
router.patch("/:id/parental-controls", parentalControls.update);

export default router;
