import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as accountController from "../controllers/accountController";
import * as settingsController from "../controllers/settingsController";
import * as pinController from "../controllers/pinController";

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

router.get("/settings", settingsController.getSettings);
router.patch("/settings", settingsController.updateSettings);

router.get("/parental-pin", pinController.getParentalStatus);
router.post("/parental-pin", pinController.setParental);
router.post("/parental-pin/verify", pinController.verifyParental);
router.delete("/parental-pin", pinController.clearParental);
router.post(
  "/parental-pin/reset/request",
  pinController.requestParentalReset,
);
router.post(
  "/parental-pin/reset/confirm",
  pinController.confirmParentalReset,
);

export default router;
