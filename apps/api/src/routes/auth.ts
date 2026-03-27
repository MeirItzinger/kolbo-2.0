import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as authController from "../controllers/authController";

const router = Router();

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/login/toveedo", authController.loginToveedo);
router.post("/logout", authController.logout);
router.post("/refresh", authController.refresh);
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerification);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/me", authenticate, authController.me);

export default router;
