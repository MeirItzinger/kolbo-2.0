import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const env = {
  PORT: parseInt(optional("PORT", "4000"), 10),
  NODE_ENV: optional("NODE_ENV", "development") as
    | "development"
    | "production"
    | "test",
  CLIENT_URL: required("CLIENT_URL"),
  DATABASE_URL: required("DATABASE_URL"),

  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET"),
  ACCESS_TOKEN_EXPIRES_IN: optional("ACCESS_TOKEN_EXPIRES_IN", "15m"),
  REFRESH_TOKEN_EXPIRES_IN: optional("REFRESH_TOKEN_EXPIRES_IN", "7d"),

  EMAIL_FROM: optional("EMAIL_FROM", "Kolbo <noreply@kolbo.com>"),
  RESEND_API_KEY: required("RESEND_API_KEY"),

  STRIPE_SECRET_KEY: required("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: required("STRIPE_WEBHOOK_SECRET"),

  MUX_TOKEN_ID: required("MUX_TOKEN_ID"),
  MUX_TOKEN_SECRET: required("MUX_TOKEN_SECRET"),
  MUX_WEBHOOK_SECRET: required("MUX_WEBHOOK_SECRET"),
  MUX_SIGNING_KEY_PRIVATE: required("MUX_SIGNING_KEY_PRIVATE"),
  MUX_SIGNING_KEY_ID: required("MUX_SIGNING_KEY_ID"),

  get isDev() {
    return this.NODE_ENV === "development";
  },
  get isProd() {
    return this.NODE_ENV === "production";
  },
  get isTest() {
    return this.NODE_ENV === "test";
  },
} as const;
