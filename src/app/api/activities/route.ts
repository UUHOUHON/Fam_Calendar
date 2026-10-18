import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { zonedDateTimeToUtc, utcToZonedParts } from "@/lib/datetime";
import {
  appBaseUrl,
  eventInviteHtml,
  sendEmail,
} from "@/lib/email";
import { serializeActivity } from "@/lib/serializers";
import { createToken } from "@/lib/tokens";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  allDay: z.boolean().optional().default(false),
  timezone: z.string().trim().min(1).optional(),
  inviteeIds: z.array(z.string()).optional().default([]),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (session.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Your membership must be accepted before planning events" },
        { status: 403 },
      );
    }

    const body = createSchema.parse(await request.json());
    const host = await prisma.member.findUnique({ where: { id: session.id } });
    if (!host) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const zone = body.timezone ?? host.timezone;
    const startAt = body.allDay
      ? zonedDateTimeToUtc(body.date, "00:00", zone)
      : zonedDateTimeToUtc(body.date, body.startTime, zone);
    const endAt = body.allDay
      ? zonedDateTimeToUtc(body.date, "23:59", zone)
      : zonedDateTimeToUtc(body.date, body.endTime, zone);

    if (endAt <= startAt) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 },
      );
    }

    const inviteeIds = Array.from(
      new Set(body.inviteeIds.filter((id) => id !== host.id)),
    );

    const invitees = inviteeIds.length
      ? await prisma.member.findMany({
          where: {
            id: { in: inviteeIds },
            familyId: host.familyId,
            status: "ACTIVE",
          },
        })
      : [];

    if (inviteeIds.length !== invitees.length) {
      return NextResponse.json(
        { error: "One or more invitees are invalid" },
        { status: 400 },
      );
    }

    const activity = await prisma.activity.create({
      data: {
        title: body.title,
        description: body.description ?? "",
        startAt,
        endAt,
        allDay: body.allDay,
        memberId: host.id,
        invites: {
          create: invitees.map((invitee) => ({
            memberId: invitee.id,
            token: createToken(),
            status: "PENDING",
          })),
        },
      },
      include: {
        member: true,
        invites: { include: { member: true } },
      },
    });

    const when = body.allDay
      ? `${body.date} (all day)`
      : `${utcToZonedParts(startAt, zone).label} – ${utcToZonedParts(endAt, zone).shortLabel}`;

    await Promise.all(
      activity.invites.map((invite) =>
        sendEmail({
          to: invite.member.email,
          subject: `${host.name} invited you: ${activity.title}`,
          html: eventInviteHtml({
            hostName: host.name,
            title: activity.title,
            when,
            link: `${appBaseUrl()}/invite/event/${invite.token}`,
          }),
        }),
      ),
    );

    return NextResponse.json(serializeActivity(activity, host.id), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
