import { NextResponse } from "next/server";
import { addDays } from "date-fns";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appBaseUrl, inviteEmailHtml, sendEmail } from "@/lib/email";
import { createToken } from "@/lib/tokens";

export async function GET() {
  try {
    const admin = await requireAdmin();
    const invites = await prisma.familyInvite.findMany({
      where: { familyId: admin.familyId },
      include: { invitedBy: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        status: i.status,
        token: i.token,
        createdAt: i.createdAt.toISOString(),
        expiresAt: i.expiresAt.toISOString(),
        invitedByName: i.invitedBy.name,
        link: `${appBaseUrl()}/signup?invite=${i.token}`,
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}

const schema = z.object({
  email: z.string().trim().email(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const { email } = schema.parse(await request.json());
    const normalized = email.toLowerCase();

    const existingMember = await prisma.member.findUnique({
      where: { email: normalized },
    });
    if (existingMember) {
      return NextResponse.json(
        { error: "That email is already a family member" },
        { status: 400 },
      );
    }

    await prisma.familyInvite.updateMany({
      where: {
        familyId: admin.familyId,
        email: normalized,
        status: "PENDING",
      },
      data: { status: "REVOKED" },
    });

    const family = await prisma.family.findUniqueOrThrow({
      where: { id: admin.familyId },
    });

    const invite = await prisma.familyInvite.create({
      data: {
        email: normalized,
        token: createToken(),
        familyId: admin.familyId,
        invitedById: admin.id,
        expiresAt: addDays(new Date(), 14),
      },
      include: { invitedBy: true },
    });

    const link = `${appBaseUrl()}/signup?invite=${invite.token}`;
    const emailResult = await sendEmail({
      to: normalized,
      subject: `Join ${family.name}`,
      html: inviteEmailHtml({
        familyName: family.name,
        inviterName: admin.name,
        link,
      }),
    });

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        status: invite.status,
        token: invite.token,
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt.toISOString(),
        invitedByName: invite.invitedBy.name,
        link,
      },
      email: emailResult,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
