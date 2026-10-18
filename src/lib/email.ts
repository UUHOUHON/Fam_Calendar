import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { prisma } from "./db";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

let etherealTransporter: Transporter | null = null;

async function getTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  if (!etherealTransporter) {
    const testAccount = await nodemailer.createTestAccount();
    etherealTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  return etherealTransporter;
}

export function appBaseUrl() {
  return (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

export async function sendEmail({ to, subject, html, text }: SendArgs) {
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from:
        process.env.SMTP_FROM ||
        '"The Family Calendar" <noreply@fam-calendar.local>',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, " "),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    await prisma.emailLog.create({
      data: {
        to,
        subject,
        body: html,
        previewUrl,
        status: "SENT",
      },
    });

    return { ok: true as const, previewUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email failed";
    await prisma.emailLog.create({
      data: {
        to,
        subject,
        body: `FAILED: ${message}\n\n${html}`,
        status: "FAILED",
      },
    });
    console.error("Email send failed:", message);
    return { ok: false as const, error: message };
  }
}

export function inviteEmailHtml(opts: {
  familyName: string;
  inviterName: string;
  link: string;
}) {
  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #1c2421;">
      <h1 style="font-size: 28px;">You're invited to ${opts.familyName}</h1>
      <p>${opts.inviterName} invited you to join the family calendar.</p>
      <p><a href="${opts.link}" style="display:inline-block;background:#0f766e;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;">Accept invite & sign up</a></p>
      <p style="color:#5d6a64;font-size:13px;">Or open this link: ${opts.link}</p>
    </div>
  `;
}

export function signupReceivedHtml(opts: { name: string; familyName: string }) {
  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #1c2421;">
      <h1 style="font-size: 28px;">Signup received</h1>
      <p>Hi ${opts.name}, thanks for joining <strong>${opts.familyName}</strong>.</p>
      <p>An admin still needs to approve your membership. We'll email you when you're accepted.</p>
    </div>
  `;
}

export function memberAcceptedHtml(opts: {
  name: string;
  familyName: string;
  link: string;
}) {
  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #1c2421;">
      <h1 style="font-size: 28px;">You're in, ${opts.name}</h1>
      <p>Your membership for <strong>${opts.familyName}</strong> was approved.</p>
      <p><a href="${opts.link}" style="display:inline-block;background:#0f766e;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;">Open family calendar</a></p>
    </div>
  `;
}

export function eventInviteHtml(opts: {
  hostName: string;
  title: string;
  when: string;
  link: string;
}) {
  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #1c2421;">
      <h1 style="font-size: 28px;">Plan together?</h1>
      <p><strong>${opts.hostName}</strong> invited you to <strong>${opts.title}</strong>.</p>
      <p>${opts.when}</p>
      <p>This event only appears on your calendar after you accept.</p>
      <p><a href="${opts.link}" style="display:inline-block;background:#0f766e;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;">View invitation</a></p>
    </div>
  `;
}
