import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
import { env } from "../config/env";

function isMulterError(
  err: Error
): err is Error & { code: string; field?: string } {
  return err.name === "MulterError" && typeof (err as { code?: string }).code === "string";
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (isMulterError(err)) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        status: "error",
        statusCode: 413,
        message: "Image too large (max 4 MB on this server).",
      });
      return;
    }
    res.status(400).json({
      status: "error",
      statusCode: 400,
      message: err.message || "Upload rejected",
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      status: "error",
      statusCode: err.statusCode,
      message: err.message,
    });
    return;
  }

  console.error("Unhandled error:", err);

  res.status(500).json({
    status: "error",
    statusCode: 500,
    message: env.isProd ? "Internal server error" : err.message,
    ...(env.isDev && { stack: err.stack }),
  });
};
