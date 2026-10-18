import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSession,
  hashPassword,
  toSessionUser,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  appBaseUrl,
  sendEmail,
  signupReceivedHtml,
} from "@/lib/email";
import { MEMBER_COLORS } from "@/lib/timezones";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().email(),
  password: z.string().min(6).max(100),
  timezone: z.string().trim().min(1),
  inviteToken: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const email = body.email.toLowerCase();

  const existing = await prisma.member.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 400 },
    );
  }

  let family = await prisma.family.findFirst({ orderBy: { createdAt: "asc" } });
  if (!family) {
    family = await prisma.family.create({
      data: { name: "The Family Calendar" },
    });
  }

  let invite = null;
  if (body.inviteToken) {
    invite = await prisma.familyInvite.findUnique({
      where: { token: body.inviteToken },
    });
    if (
      !invite ||
      invite.status !== "PENDING" ||
      invite.expiresAt < new Date() ||
      invite.email.toLowerCase() !== email
    ) {
      return NextResponse.json(
        { error: "Invite is invalid, expired, or email does not match" },
        { status: 400 },
      );
    }
  }

  const memberCount = await prisma.member.count({
    where: { familyId: family.id },
  });
  const isFirst = memberCount === 0;

  const member = await prisma.member.create({
    data: {
      name: body.name,
      email,
      passwordHash: await hashPassword(body.password),
      timezone: body.timezone,
      color: MEMBER_COLORS[memberCount % MEMBER_COLORS.length],
      role: isFirst ? "ADMIN" : "MEMBER",
      status: isFirst ? "ACTIVE" : "PENDING",
      familyId: family.id,
    },
  });

  if (invite) {
    await prisma.familyInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    });
  }

  const welcome = await sendEmail({
    to: email,
    subject: isFirst
      ? `Welcome to ${family.name}`
      : `Signup received for ${family.name}`,
    html: isFirst
      ? `<div style="font-family:Georgia,serif"><h1>Welcome, ${member.name}</h1><p>You're the family admin. Open the calendar and invite relatives from Admin.</p><p><a href="${appBaseUrl()}">Open The Family Calendar</a></p></div>`
      : signupReceivedHtml({ name: member.name, familyName: family.name }),
  });

  // Notify admins about pending signup
  if (!isFirst) {
    const admins = await prisma.member.findMany({
      where: { familyId: family.id, role: "ADMIN", status: "ACTIVE" },
    });
    await Promise.all(
      admins.map((admin) =>
        sendEmail({
          to: admin.email,
          subject: `New member signup: ${member.name}`,
          html: `<div style="font-family:Georgia,serif"><p><strong>${member.name}</strong> (${member.email}) signed up and is waiting for approval.</p><p><a href="${appBaseUrl()}/admin">Review in Admin</a></p></div>`,
        }),
      ),
    );
  }

  await createSession(toSessionUser(member));

  return NextResponse.json({
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status,
    },
    emailSent: welcome.ok,
    emailError: welcome.ok ? undefined : welcome.error,
  });
}
