import { Router } from "express";
import { authenticate } from "../middleware/auth";
import * as profileController from "../controllers/profileController";

const router = Router();

router.use(authenticate);

router.get("/", profileController.list);
router.get("/:id", profileController.get);
router.post("/", profileController.create);
router.patch("/:id", profileController.update);
router.delete("/:id", profileController.remove);

export default router;
