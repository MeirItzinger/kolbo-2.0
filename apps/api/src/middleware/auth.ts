import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

export const authenticate = async (
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

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        isActive: true,
        roles: {
          select: {
            role: { select: { key: true } },
            channelId: true,
            creatorProfileId: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw ApiError.unauthorized("User not found or deactivated");
    }

    req.user = {
      id: user.id,
      email: user.email,
      roles: user.roles.map((r) => ({
        key: r.role.key,
        channelId: r.channelId ?? undefined,
        creatorProfileId: r.creatorProfileId ?? undefined,
      })),
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

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next();
  }

  try {
    const token = header.slice(7);
    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        isActive: true,
        roles: {
          select: {
            role: { select: { key: true } },
            channelId: true,
            creatorProfileId: true,
          },
        },
      },
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        roles: user.roles.map((r) => ({
          key: r.role.key,
          channelId: r.channelId ?? undefined,
          creatorProfileId: r.creatorProfileId ?? undefined,
        })),
      };
    }
  } catch {
    // Token invalid or expired — silently continue unauthenticated
  }

  next();
};
