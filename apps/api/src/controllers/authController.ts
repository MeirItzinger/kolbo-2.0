import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as authService from "../services/auth/authService";
import { loginViaUscreen } from "../services/access/uscreenAuthService";
import { ApiError } from "../utils/apiError";

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body;
  const result = await authService.signup(email, password, firstName, lastName);
  res.status(201).json({ status: "success", data: result });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await authService.login(email, password);

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth/refresh",
  });

  return res.json({
    status: "success",
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      sessionId: result.sessionId,
      user: result.user,
    },
  });
});

export const loginToveedo = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const uscreen = await loginViaUscreen(email, password);

  if (!uscreen.success || !uscreen.accessToken) {
    throw ApiError.unauthorized("Invalid Toveedo credentials");
  }

  res.json({
    status: "success",
    data: {
      accessToken: null,
      refreshToken: null,
      sessionId: null,
      uscreenAccessToken: uscreen.accessToken,
      channelSlug: "toveedo",
      user: {
        id: `uscreen_${uscreen.user?.id ?? "unknown"}`,
        email: uscreen.user?.email ?? email,
        firstName: uscreen.user?.name?.split(" ")[0] ?? "",
        lastName: uscreen.user?.name?.split(" ").slice(1).join(" ") ?? "",
        roles: [],
      },
    },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  await authService.logout(sessionId);
  res.clearCookie("refreshToken", { path: "/api/auth/refresh" });
  res.json({ status: "success", message: "Logged out" });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token =
    req.cookies?.refreshToken || req.body.refreshToken;

  if (!token) {
    res.status(400).json({ status: "error", message: "Refresh token required" });
    return;
  }

  const result = await authService.refreshTokens(token);

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth/refresh",
  });

  res.json({
    status: "success",
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      sessionId: result.sessionId,
    },
  });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;
  const result = await authService.verifyEmail(token);
  res.json({ status: "success", ...result });
});

export const resendVerification = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await authService.resendVerification(email);
    res.json({ status: "success", ...result });
  }
);

export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    res.json({ status: "success", ...result });
  }
);

export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;
    const result = await authService.resetPassword(token, newPassword);
    res.json({ status: "success", ...result });
  }
);

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.user!.id);
  res.json({ status: "success", data: user });
});
