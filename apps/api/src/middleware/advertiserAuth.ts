import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

declare global {
  namespace Express {
    interface Request {
      advertiser?: {
        id: string;
        email: string;
      };
    }
  }
}

export const authenticateAdvertiser = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Missing or malformed authorization header");
    }

    const token = header.slice(7);
    const decoded = verifyAccessToken(token);

    if (decoded.type !== "advertiser") {
      throw ApiError.unauthorized("This route requires an advertiser token");
    }

    const advertiser = await prisma.advertiser.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, isActive: true },
    });

    if (!advertiser || !advertiser.isActive) {
      throw ApiError.unauthorized("Advertiser not found or deactivated");
    }

    req.advertiser = {
      id: advertiser.id,
      email: advertiser.email,
    };

    next();
  } catch (err) {
    if (err instanceof ApiError) {
      next(err);
    } else {
      next(ApiError.unauthorized("Invalid or expired access token"));
    }
  }
};
