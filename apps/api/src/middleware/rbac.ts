import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/apiError";

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    const hasRole = req.user.roles.some((r) => roles.includes(r.key));
    if (!hasRole) {
      return next(
        ApiError.forbidden("You do not have the required role for this action")
      );
    }

    next();
  };
}

/**
 * Checks that the authenticated user holds a CHANNEL_ADMIN role
 * scoped to the channel specified by `req.params[paramName]`.
 * SUPER_ADMIN bypasses the check.
 */
export function requireChannelAccess(paramName = "channelId") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    const channelId = req.params[paramName];
    if (!channelId) {
      return next(ApiError.badRequest(`Missing param: ${paramName}`));
    }

    const isSuperAdmin = req.user.roles.some((r) => r.key === "SUPER_ADMIN");
    if (isSuperAdmin) {
      return next();
    }

    const hasAccess = req.user.roles.some(
      (r) => r.key === "CHANNEL_ADMIN" && r.channelId === channelId
    );
    if (!hasAccess) {
      return next(
        ApiError.forbidden("You do not have admin access to this channel")
      );
    }

    next();
  };
}

/**
 * Checks that the authenticated user holds a CREATOR_ADMIN role
 * scoped to the creator profile specified by `req.params[paramName]`.
 * SUPER_ADMIN bypasses the check.
 */
export function requireCreatorAccess(paramName = "creatorProfileId") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    const creatorProfileId = req.params[paramName];
    if (!creatorProfileId) {
      return next(ApiError.badRequest(`Missing param: ${paramName}`));
    }

    const isSuperAdmin = req.user.roles.some((r) => r.key === "SUPER_ADMIN");
    if (isSuperAdmin) {
      return next();
    }

    const hasAccess = req.user.roles.some(
      (r) =>
        r.key === "CREATOR_ADMIN" && r.creatorProfileId === creatorProfileId
    );
    if (!hasAccess) {
      return next(
        ApiError.forbidden(
          "You do not have admin access to this creator profile"
        )
      );
    }

    next();
  };
}
