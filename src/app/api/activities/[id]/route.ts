import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { zonedDateTimeToUtc } from "@/lib/datetime";
import { serializeActivity } from "@/lib/serializers";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  allDay: z.boolean().optional(),
  timezone: z.string().trim().min(1).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = updateSchema.parse(await request.json());

    const existing = await prisma.activity.findUnique({
      where: { id },
      include: { member: true, invites: { include: { member: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }
    if (existing.memberId !== session.id && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const zone = body.timezone ?? existing.member.timezone;
    let startAt = existing.startAt;
    let endAt = existing.endAt;
    const allDay = body.allDay ?? existing.allDay;

    if (body.date || body.startTime || body.endTime || body.allDay !== undefined) {
      const date =
        body.date ??
        new Intl.DateTimeFormat("en-CA", {
          timeZone: zone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(existing.startAt);

      const startTime = body.startTime ?? "09:00";
      const endTime = body.endTime ?? "10:00";

      startAt = allDay
        ? zonedDateTimeToUtc(date, "00:00", zone)
        : zonedDateTimeToUtc(date, startTime, zone);
      endAt = allDay
        ? zonedDateTimeToUtc(date, "23:59", zone)
        : zonedDateTimeToUtc(date, endTime, zone);

      if (endAt <= startAt) {
        return NextResponse.json(
          { error: "End time must be after start time" },
          { status: 400 },
        );
      }
    }

    const activity = await prisma.activity.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        startAt,
        endAt,
        allDay,
      },
      include: {
        member: true,
        invites: { include: { member: true } },
      },
    });

    return NextResponse.json(serializeActivity(activity, session.id));
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const existing = await prisma.activity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }
    if (existing.memberId !== session.id && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.activity.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
