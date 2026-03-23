import express from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import {
  env,
  normalizeUrlOrigin,
  parseCorsExtraOrigins,
} from "./config/env";
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler } from "./middleware/errorHandler";
import apiRoutes from "./routes";

const app = express();

const corsAllowedOrigins = new Set<string>([
  normalizeUrlOrigin(env.CLIENT_URL),
  ...parseCorsExtraOrigins().map(normalizeUrlOrigin),
]);

// ─── CORS ───────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalized = normalizeUrlOrigin(origin);
      if (
        corsAllowedOrigins.has(origin) ||
        corsAllowedOrigins.has(normalized) ||
        /^http:\/\/localhost:\d+$/.test(origin) ||
        /^https:\/\/[^\s]+\.vercel\.app$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ─── Raw body for Stripe webhooks (must come BEFORE json parser) ────
app.use(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" })
);

// ─── Body parsers ───────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Request logger ─────────────────────────────────────
app.use(requestLogger);

// ─── Health check ───────────────────────────────────────
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
};
app.get("/health", healthHandler);
/** Same JSON at `/api/health` so Vercel can route only `/api/*` to serverless. */
app.get("/api/health", healthHandler);

// ─── Static uploads ──────────────────────────────────────
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

// ─── API routes ─────────────────────────────────────────
app.use("/api", apiRoutes);

// ─── 404 catch-all ──────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

// ─── Error handler (must be last) ───────────────────────
app.use(errorHandler);

// ─── Start server (local / traditional hosting only; Vercel uses serverless) ───
if (!process.env.VERCEL) {
  const server = app.listen(env.PORT, () => {
    console.log(
      `[kolbo-api] Server running on port ${env.PORT} (${env.NODE_ENV})`
    );
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[kolbo-api] Port ${env.PORT} already in use – retrying in 2s…`);
      setTimeout(() => {
        server.close();
        server.listen(env.PORT);
      }, 2000);
    } else {
      throw err;
    }
  });
}

export default app;
