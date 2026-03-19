import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as accountController from "../controllers/accountController";

const router = Router();

router.use(authenticate);

router.get("/subscriptions", accountController.getSubscriptions);
router.post("/subscriptions/cancel", accountController.cancelSubscription);
router.post("/subscriptions/reactivate", accountController.reactivateUserSubscription);
router.get("/purchases", accountController.getPurchases);
router.get("/rentals", accountController.getRentals);
router.get("/payment-methods", accountController.getPaymentMethods);
router.get("/devices", accountController.getDevices);
router.get("/watch-history", accountController.getWatchHistory);

export default router;
