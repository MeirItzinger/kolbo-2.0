import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as stripeController from "../controllers/stripeController";
import { requirePurchasePin } from "../controllers/pinController";

const router = Router();

router.post(
  "/checkout/subscription",
  authenticate,
  requirePurchasePin,
  stripeController.createCheckoutForSubscription,
);

router.post(
  "/checkout/subscriptions",
  authenticate,
  requirePurchasePin,
  stripeController.createCheckoutForMultiSubscription,
);

router.post(
  "/checkout/bundle",
  authenticate,
  requirePurchasePin,
  stripeController.createCheckoutForBundle,
);

router.post(
  "/checkout/rental",
  authenticate,
  requirePurchasePin,
  stripeController.createCheckoutForRental,
);

router.post(
  "/checkout/purchase",
  authenticate,
  requirePurchasePin,
  stripeController.createCheckoutForPurchase,
);

router.get(
  "/session/:sessionId",
  authenticate,
  stripeController.verifySession,
);

export default router;
