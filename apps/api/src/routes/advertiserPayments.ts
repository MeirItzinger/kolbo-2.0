import { Router } from "express";
import * as ctrl from "../controllers/advertiserPaymentController";
import { authenticateAdvertiser } from "../middleware/advertiserAuth";

const router = Router();

router.use(authenticateAdvertiser);

router.post("/setup-intent", ctrl.createSetupIntent);
router.post("/complete-setup", ctrl.completeSetup);
router.get("/", ctrl.listPaymentMethods);
router.delete("/:id", ctrl.removePaymentMethod);

export default router;
