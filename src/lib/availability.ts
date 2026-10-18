import { eachDayOfInterval, format, parseISO } from "date-fns";
import type { ActivityDTO, MemberDTO } from "./types";
import {
  localDayBoundsUtc,
  overlaps,
  utcToZonedParts,
  zonedDateTimeToUtc,
} from "./datetime";

export type BusyBlock = {
  activityId: string;
  title: string;
  startAt: string;
  endAt: string;
  memberId: string;
};

export type MemberDayStatus = {
  memberId: string;
  memberName: string;
  color: string;
  busy: boolean;
  blocks: BusyBlock[];
};

export type DayAvailability = {
  date: string;
  members: MemberDayStatus[];
};

/** Activities that count as busy for a member (hosted or accepted invite). */
export function activitiesForMemberBusy(
  activities: ActivityDTO[],
  memberId: string,
): ActivityDTO[] {
  return activities.filter((a) => {
    if (a.memberId === memberId) return true;
    return a.invites.some(
      (i) => i.memberId === memberId && i.status === "ACCEPTED",
    );
  });
}

export function findMemberConflicts(opts: {
  activities: ActivityDTO[];
  memberIds: string[];
  members: MemberDTO[];
  rangeStart: Date;
  rangeEnd: Date;
  excludeActivityId?: string;
}): Array<{
  memberId: string;
  memberName: string;
  color: string;
  conflicts: BusyBlock[];
}> {
  return opts.memberIds.map((memberId) => {
    const member = opts.members.find((m) => m.id === memberId);
    const mine = activitiesForMemberBusy(opts.activities, memberId).filter(
      (a) => a.id !== opts.excludeActivityId,
    );
    const conflicts: BusyBlock[] = mine
      .filter((a) =>
        overlaps(
          new Date(a.startAt),
          new Date(a.endAt),
          opts.rangeStart,
          opts.rangeEnd,
        ),
      )
      .map((a) => ({
        activityId: a.id,
        title: a.title,
        startAt: a.startAt,
        endAt: a.endAt,
        memberId: a.memberId,
      }));

    return {
      memberId,
      memberName: member?.name ?? "Member",
      color: member?.color ?? "#666",
      conflicts,
    };
  }).filter((row) => row.conflicts.length > 0);
}

export function buildRangeAvailability(opts: {
  startDate: string;
  endDate: string;
  viewerTimezone: string;
  members: MemberDTO[];
  activities: ActivityDTO[];
}): DayAvailability[] {
  const start = parseISO(`${opts.startDate}T12:00:00`);
  const end = parseISO(`${opts.endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [];
  }

  const days = eachDayOfInterval({ start, end });

  return days.map((day) => {
    const dayKey = format(day, "yyyy-MM-dd");
    const { start: dayStart, end: dayEnd } = localDayBoundsUtc(
      dayKey,
      opts.viewerTimezone,
    );

    return {
      date: dayKey,
      members: opts.members.map((member) => {
        const blocks = activitiesForMemberBusy(opts.activities, member.id)
          .filter((a) =>
            overlaps(
              new Date(a.startAt),
              new Date(a.endAt),
              dayStart,
              dayEnd,
            ),
          )
          .map((a) => ({
            activityId: a.id,
            title: a.title,
            startAt: a.startAt,
            endAt: a.endAt,
            memberId: a.memberId,
          }));

        return {
          memberId: member.id,
          memberName: member.name,
          color: member.color,
          busy: blocks.length > 0,
          blocks,
        };
      }),
    };
  });
}

export function proposedRangeUtc(opts: {
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  timezone: string;
}) {
  const startAt = opts.allDay
    ? zonedDateTimeToUtc(opts.date, "00:00", opts.timezone)
    : zonedDateTimeToUtc(opts.date, opts.startTime, opts.timezone);
  const endAt = opts.allDay
    ? zonedDateTimeToUtc(opts.date, "23:59", opts.timezone)
    : zonedDateTimeToUtc(opts.date, opts.endTime, opts.timezone);
  return { startAt, endAt };
}

export function formatConflictLabel(
  block: BusyBlock,
  viewerTimezone: string,
): string {
  const start = utcToZonedParts(block.startAt, viewerTimezone);
  const end = utcToZonedParts(block.endAt, viewerTimezone);
  return `${block.title} (${start.shortLabel} – ${end.shortLabel})`;
}
