import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as profileController from "../controllers/profileController";

const router = Router();

router.use(authenticate);

router.get("/", profileController.list);
router.get("/:id", profileController.getById);
router.post("/", profileController.create);
router.patch("/:id", profileController.update);
router.delete("/:id", profileController.remove);

router.post("/:id/pin", profileController.setPin);
router.post("/:id/pin/verify", profileController.verifyPin);
router.delete("/:id/pin", profileController.clearPin);

router.patch("/:id/parental-controls", profileController.updateParentalControls);

export default router;
