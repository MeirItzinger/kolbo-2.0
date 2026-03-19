import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";
import { env } from "../config/env";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
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
