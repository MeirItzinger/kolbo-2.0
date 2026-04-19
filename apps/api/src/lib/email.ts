import { Resend } from "resend";
import { env } from "../config/env";

const resend = new Resend(env.RESEND_API_KEY);

function wrapHtml(title: string, body: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${title}</h2>
      ${body}
    </div>
  `;
}

function ctaButton(label: string, href: string): string {
  return `
    <a href="${href}"
       style="display: inline-block; padding: 12px 24px; background: #6366f1;
              color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
      ${label}
    </a>
  `;
}

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${token}`;

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Verify your Kolbo account",
    html: wrapHtml(
      "Welcome to Kolbo",
      `
        <p>Click the button below to verify your email address.</p>
        ${ctaButton("Verify Email", verifyUrl)}
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
        <p style="color: #9ca3af; font-size: 12px;">Or copy this link: ${verifyUrl}</p>
      `
    ),
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
    html: wrapHtml(
      "Password Reset",
      `
        <p>You requested a password reset. Click the button below to choose a new password.</p>
        ${ctaButton("Reset Password", resetUrl)}
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
        <p style="color: #9ca3af; font-size: 12px;">Or copy this link: ${resetUrl}</p>
      `
    ),
  });
}

export interface SendInviteEmailArgs {
  to: string;
  inviteUrl: string;
  inviterName?: string;
  contextLabel?: string;
}

export async function sendInviteEmail({
  to,
  inviteUrl,
  inviterName,
  contextLabel,
}: SendInviteEmailArgs): Promise<void> {
  const inviterLine = inviterName
    ? `<p>${inviterName} has invited you to Kolbo${contextLabel ? ` as <strong>${contextLabel}</strong>` : ""}.</p>`
    : `<p>You've been invited to Kolbo${contextLabel ? ` as <strong>${contextLabel}</strong>` : ""}.</p>`;

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "You've been invited to Kolbo",
    html: wrapHtml(
      "Welcome to Kolbo",
      `
        ${inviterLine}
        <p>Click the button below to set your password and access your account.</p>
        ${ctaButton("Accept Invite", inviteUrl)}
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          This link expires in 7 days.
        </p>
        <p style="color: #9ca3af; font-size: 12px;">Or copy this link: ${inviteUrl}</p>
      `
    ),
  });
}
