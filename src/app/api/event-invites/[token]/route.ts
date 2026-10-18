import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { utcToZonedParts } from "@/lib/datetime";
import { serializeActivity } from "@/lib/serializers";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const invite = await prisma.activityInvite.findUnique({
    where: { token },
    include: {
      member: true,
      activity: {
        include: {
          member: true,
          invites: { include: { member: true } },
        },
      },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const session = await getSession();
  const host = invite.activity.member;
  const when = invite.activity.allDay
    ? utcToZonedParts(invite.activity.startAt, host.timezone).dayLabel +
      " (all day)"
    : `${utcToZonedParts(invite.activity.startAt, host.timezone).label} – ${utcToZonedParts(invite.activity.endAt, host.timezone).shortLabel}`;

  return NextResponse.json({
    invite: {
      id: invite.id,
      status: invite.status,
      memberId: invite.memberId,
      memberEmail: invite.member.email,
    },
    activity: serializeActivity(invite.activity, session?.id),
    when,
    canRespond:
      !!session &&
      session.id === invite.memberId &&
      invite.status === "PENDING",
    needsLogin: !session || session.id !== invite.memberId,
  });
}

const schema = z.object({
  action: z.enum(["accept", "decline"]),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { token } = await context.params;
    const { action } = schema.parse(await request.json());

    const invite = await prisma.activityInvite.findUnique({
      where: { token },
      include: {
        activity: {
          include: {
            member: true,
            invites: { include: { member: true } },
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }
    if (invite.memberId !== session.id) {
      return NextResponse.json(
        { error: "This invitation belongs to a different account" },
        { status: 403 },
      );
    }

    const updated = await prisma.activityInvite.update({
      where: { id: invite.id },
      data: {
        status: action === "accept" ? "ACCEPTED" : "DECLINED",
        respondedAt: new Date(),
      },
      include: {
        activity: {
          include: {
            member: true,
            invites: { include: { member: true } },
          },
        },
      },
    });

    return NextResponse.json({
      invite: {
        id: updated.id,
        status: updated.status,
      },
      activity: serializeActivity(updated.activity, session.id),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
