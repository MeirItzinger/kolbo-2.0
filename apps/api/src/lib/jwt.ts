import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface TokenPayload {
  sub: string;
  email: string;
}

export function signAccessToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as string,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as string,
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string): TokenPayload & JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload & JwtPayload;
}

export function verifyRefreshToken(token: string): TokenPayload & JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload &
    JwtPayload;
}
