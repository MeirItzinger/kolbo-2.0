import { Router } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuid } from "uuid";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import type { Request, Response } from "express";

const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} is not allowed`));
    }
  },
});

const router = Router();

router.post(
  "/image",
  authenticate,
  requireRole("SUPER_ADMIN", "CHANNEL_ADMIN", "CREATOR_ADMIN"),
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest("No file uploaded");

    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ status: "success", data: { url } });
  }),
);

export default router;
