import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { put } from "@vercel/blob";
import { v4 as uuid } from "uuid";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import type { Request, Response } from "express";

const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

/** Vercel serverless request bodies are capped (~4.5 MB); stay under with multipart overhead. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(ApiError.badRequest(`File type ${ext} is not allowed`));
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
    if (!req.file?.buffer) throw ApiError.badRequest("No file uploaded");

    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    if (!allowed.includes(ext)) {
      throw ApiError.badRequest(`File type ${ext} is not allowed`);
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    const blobAccessEnv = process.env.BLOB_ACCESS?.trim().toLowerCase();
    const blobAccess: "public" | "private" =
      blobAccessEnv === "private" ? "private" : "public";

    if (token) {
      const pathname = `kolbo/images/${uuid()}${ext}`;
      try {
        const blob = await put(pathname, req.file.buffer, {
          access: blobAccess,
          token,
          contentType: req.file.mimetype || `image/${ext.replace(".", "")}`,
        });
        res.status(201).json({ status: "success", data: { url: blob.url } });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Blob upload failed";
        console.error("[uploads] Vercel Blob put failed:", err);
        if (
          message.includes("private store") &&
          message.includes("public access")
        ) {
          throw ApiError.badRequest(
            "This Vercel Blob store is Private but the app defaults to public uploads. " +
              "Recommended for channel/hero images: create a Public Blob store (Vercel → Storage → Blob) and connect it to this project so images work in the browser. " +
              "Alternatively set env BLOB_ACCESS=private to match a private store (images will not load in <img> on public pages unless you add a proxy)."
          );
        }
        throw ApiError.internal(
          `Image storage failed: ${message}. Check BLOB_READ_WRITE_TOKEN, BLOB_ACCESS (public|private), and your Blob store in Vercel.`
        );
      }
      return;
    }

    if (process.env.VERCEL) {
      throw ApiError.internal(
        "Image uploads require Vercel Blob: add a Blob store to this project (env BLOB_READ_WRITE_TOKEN) and redeploy."
      );
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    const filename = `${uuid()}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
    const url = `/uploads/${filename}`;
    res.status(201).json({ status: "success", data: { url } });
  }),
);

export default router;
