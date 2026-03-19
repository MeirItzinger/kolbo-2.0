import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as discountController from "../controllers/discountController";

const router = Router();

router.post("/validate", authenticate, discountController.validate);

export default router;
