import { eachMinuteOfInterval, max, min } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { ActivityDTO, DayAlignment, MemberDTO, OverlapWindow } from "./types";
import {
  dayKeyInZone,
  formatOffsetLabel,
  localDayBoundsUtc,
  overlaps,
  utcToZonedParts,
} from "./datetime";

export function buildDayAlignment(
  viewerDateKey: string,
  viewerTimezone: string,
  members: MemberDTO[],
): DayAlignment {
  const noonUtcApprox = new Date(`${viewerDateKey}T12:00:00Z`);
  // Use a fixed instant: viewer local noon for the selected day
  const { start } = localDayBoundsUtc(viewerDateKey, viewerTimezone);
  const midpoint = new Date(start.getTime() + 12 * 60 * 60 * 1000);

  return {
    viewerDate: viewerDateKey,
    members: members.map((member) => {
      const localDate = dayKeyInZone(midpoint, member.timezone);
      return {
        memberId: member.id,
        memberName: member.name,
        color: member.color,
        timezone: member.timezone,
        localDate,
        localWeekday: formatInTimeZone(midpoint, member.timezone, "EEEE"),
        offsetLabel: formatOffsetLabel(midpoint || noonUtcApprox, member.timezone),
        isSameCalendarDay: localDate === viewerDateKey,
      };
    }),
  };
}

type Interval = {
  start: Date;
  end: Date;
  memberId: string;
  activityId: string;
};

/**
 * Finds windows where 2+ members have overlapping activities (busy overlap).
 * Useful for spotting shared commitments across time zones.
 */
export function findBusyOverlaps(
  activities: ActivityDTO[],
  rangeStart: Date,
  rangeEnd: Date,
): OverlapWindow[] {
  const intervals: Interval[] = activities
    .map((a) => ({
      start: new Date(a.startAt),
      end: new Date(a.endAt),
      memberId: a.memberId,
      activityId: a.id,
    }))
    .filter((i) => overlaps(i.start, i.end, rangeStart, rangeEnd))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const windows: OverlapWindow[] = [];

  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i];
      const b = intervals[j];
      if (a.memberId === b.memberId) continue;
      if (!overlaps(a.start, a.end, b.start, b.end)) continue;

      const start = max([a.start, b.start]);
      const end = min([a.end, b.end]);
      if (start >= end) continue;

      const memberIds = Array.from(new Set([a.memberId, b.memberId])).sort();
      const activityIds = Array.from(
        new Set([a.activityId, b.activityId]),
      ).sort();
      const key = `${start.toISOString()}|${end.toISOString()}|${memberIds.join(",")}`;

      if (
        !windows.some(
          (w) =>
            `${w.startAt}|${w.endAt}|${[...w.memberIds].sort().join(",")}` ===
            key,
        )
      ) {
        windows.push({
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          memberIds,
          activityIds,
        });
      }
    }
  }

  return windows.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
}

/**
 * Finds free-time overlap across selected members within a viewer's local day.
 * Assumes "available" = no activity covering that minute.
 */
export function findFreeOverlapsForDay(
  viewerDateKey: string,
  viewerTimezone: string,
  members: MemberDTO[],
  activities: ActivityDTO[],
  selectedMemberIds: string[],
): OverlapWindow[] {
  if (selectedMemberIds.length < 2) return [];

  const { start, end } = localDayBoundsUtc(viewerDateKey, viewerTimezone);
  const stepMs = 30 * 60 * 1000;
  const ticks = eachMinuteOfInterval(
    { start, end },
    { step: 30 },
  );

  const memberBusy = new Map<string, Interval[]>();
  for (const id of selectedMemberIds) {
    memberBusy.set(
      id,
      activities
        .filter((a) => a.memberId === id)
        .map((a) => ({
          start: new Date(a.startAt),
          end: new Date(a.endAt),
          memberId: a.memberId,
          activityId: a.id,
        })),
    );
  }

  const freeTicks: Date[] = [];
  for (const tick of ticks) {
    const tickEnd = new Date(tick.getTime() + stepMs);
    const allFree = selectedMemberIds.every((id) => {
      const busy = memberBusy.get(id) ?? [];
      return !busy.some((b) => overlaps(tick, tickEnd, b.start, b.end));
    });
    if (allFree) freeTicks.push(tick);
  }

  const windows: OverlapWindow[] = [];
  let runStart: Date | null = null;
  let prev: Date | null = null;

  for (const tick of freeTicks) {
    if (!runStart) {
      runStart = tick;
      prev = tick;
      continue;
    }
    if (prev && tick.getTime() - prev.getTime() === stepMs) {
      prev = tick;
      continue;
    }
    if (runStart && prev) {
      windows.push({
        startAt: runStart.toISOString(),
        endAt: new Date(prev.getTime() + stepMs).toISOString(),
        memberIds: [...selectedMemberIds],
        activityIds: [],
      });
    }
    runStart = tick;
    prev = tick;
  }

  if (runStart && prev) {
    windows.push({
      startAt: runStart.toISOString(),
      endAt: new Date(prev.getTime() + stepMs).toISOString(),
      memberIds: [...selectedMemberIds],
      activityIds: [],
    });
  }

  // Keep meaningful windows (at least 1 hour) and cap noise
  return windows
    .filter(
      (w) =>
        new Date(w.endAt).getTime() - new Date(w.startAt).getTime() >=
        60 * 60 * 1000,
    )
    .slice(0, 12);
}

export function activitiesForViewerDay(
  activities: ActivityDTO[],
  viewerDateKey: string,
  viewerTimezone: string,
): ActivityDTO[] {
  const { start, end } = localDayBoundsUtc(viewerDateKey, viewerTimezone);
  return activities
    .filter((a) => overlaps(new Date(a.startAt), new Date(a.endAt), start, end))
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
}

export function describeActivityInZones(
  activity: ActivityDTO,
  viewerTimezone: string,
) {
  const ownerZone = activity.member.timezone;
  const owner = utcToZonedParts(activity.startAt, ownerZone);
  const ownerEnd = utcToZonedParts(activity.endAt, ownerZone);
  const viewer = utcToZonedParts(activity.startAt, viewerTimezone);
  const viewerEnd = utcToZonedParts(activity.endAt, viewerTimezone);

  return {
    ownerRange: activity.allDay
      ? `${owner.dayLabel} (all day)`
      : `${owner.shortLabel} – ${ownerEnd.shortLabel} (${ownerZone.split("/").pop()})`,
    viewerRange: activity.allDay
      ? `${viewer.dayLabel} (all day)`
      : `${viewer.shortLabel} – ${viewerEnd.shortLabel}`,
    crossesViewerDay: owner.date !== viewer.date,
  };
}
