import { Resend } from "resend";
import { env } from "../config/env";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${token}`;

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Verify your Kolbo account",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Kolbo</h2>
        <p>Click the button below to verify your email address.</p>
        <a href="${verifyUrl}"
           style="display: inline-block; padding: 12px 24px; background: #6366f1;
                  color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Verify Email
        </a>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
        <p style="color: #9ca3af; font-size: 12px;">
          Or copy this link: ${verifyUrl}
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<void> {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Reset your Kolbo password",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>You requested a password reset. Click the button below to choose a new password.</p>
        <a href="${resetUrl}"
           style="display: inline-block; padding: 12px 24px; background: #6366f1;
                  color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Reset Password
        </a>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
        <p style="color: #9ca3af; font-size: 12px;">
          Or copy this link: ${resetUrl}
        </p>
      </div>
    `,
  });
}
