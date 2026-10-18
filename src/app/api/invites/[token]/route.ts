import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const invite = await prisma.familyInvite.findUnique({
    where: { token },
    include: { family: true, invitedBy: true },
  });

  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Invite is invalid or expired" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    email: invite.email,
    familyName: invite.family.name,
    invitedByName: invite.invitedBy.name,
    token: invite.token,
  });
}
