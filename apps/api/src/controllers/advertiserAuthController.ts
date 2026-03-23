import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as advertiserAuthService from "../services/advertiser/advertiserAuthService";

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, companyName, contactName, phone } = req.body;
  const result = await advertiserAuthService.signup(
    email,
    password,
    companyName,
    contactName,
    phone
  );
  res.status(201).json({ status: "success", data: result });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await advertiserAuthService.login(email, password);

  res.cookie("advRefreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/advertiser/auth/refresh",
  });

  res.json({ status: "success", data: result });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await advertiserAuthService.logoutAll(req.advertiser!.id);
  res.clearCookie("advRefreshToken", {
    path: "/api/advertiser/auth/refresh",
  });
  res.json({ status: "success", message: "Logged out" });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res
      .status(400)
      .json({ status: "error", message: "Refresh token required" });
  }
  const result = await advertiserAuthService.refreshTokens(refreshToken);
  res.json({ status: "success", data: result });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const advertiser = await advertiserAuthService.getCurrentAdvertiser(
    req.advertiser!.id
  );
  res.json({ status: "success", data: advertiser });
});
