import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { buildRangeAvailability } from "@/lib/availability";
import { prisma } from "@/lib/db";
import { serializeActivity, serializeMember } from "@/lib/serializers";

const querySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Returns free/busy for all active family members across a date range.
 * Includes every member's hosted + accepted activities so planners can
 * detect conflicts even before invites are accepted.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (session.status !== "ACTIVE") {
      return NextResponse.json({ error: "Membership pending" }, { status: 403 });
    }

    const url = new URL(request.url);
    const parsed = querySchema.parse({
      start: url.searchParams.get("start"),
      end: url.searchParams.get("end"),
    });

    const members = await prisma.member.findMany({
      where: { familyId: session.familyId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });

    const me = members.find((m) => m.id === session.id);
    const activities = await prisma.activity.findMany({
      where: { member: { familyId: session.familyId } },
      include: {
        member: true,
        invites: { include: { member: true } },
      },
      orderBy: { startAt: "asc" },
    });

    // For availability, use all activities (not visibility-filtered)
    const activityDtos = activities.map((a) => serializeActivity(a, session.id));
    const memberDtos = members.map(serializeMember);

    const days = buildRangeAvailability({
      startDate: parsed.start,
      endDate: parsed.end,
      viewerTimezone: me?.timezone ?? session.timezone,
      members: memberDtos,
      activities: activityDtos,
    });

    return NextResponse.json({
      start: parsed.start,
      end: parsed.end,
      timezone: me?.timezone ?? session.timezone,
      members: memberDtos,
      activities: activityDtos,
      days,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    throw error;
  }
}
