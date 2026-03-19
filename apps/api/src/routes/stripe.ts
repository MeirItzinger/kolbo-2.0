import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as stripeController from "../controllers/stripeController";

const router = Router();

router.post(
  "/checkout/subscription",
  authenticate,
  stripeController.createCheckoutForSubscription
);

router.post(
  "/checkout/subscriptions",
  authenticate,
  stripeController.createCheckoutForMultiSubscription
);

router.post(
  "/checkout/bundle",
  authenticate,
  stripeController.createCheckoutForBundle
);

router.post(
  "/checkout/rental",
  authenticate,
  stripeController.createCheckoutForRental
);

router.post(
  "/checkout/purchase",
  authenticate,
  stripeController.createCheckoutForPurchase
);

router.get(
  "/session/:sessionId",
  authenticate,
  stripeController.verifySession
);

export default router;
