import express from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler } from "./middleware/errorHandler";
import apiRoutes from "./routes";

const app = express();

// ─── CORS ───────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === env.CLIENT_URL || /^http:\/\/localhost:\d+$/.test(origin)) {
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
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

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

// ─── Start server ───────────────────────────────────────
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

export default app;
