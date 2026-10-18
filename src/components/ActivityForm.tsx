"use client";

import { useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import {
  findMemberConflicts,
  formatConflictLabel,
  proposedRangeUtc,
} from "@/lib/availability";
import type { ActivityDTO, MemberDTO } from "@/lib/types";
import { COMMON_TIMEZONES } from "@/lib/timezones";

type Props = {
  members: MemberDTO[];
  activities: ActivityDTO[];
  currentMemberId: string;
  viewerTimezone: string;
  defaultDate: string;
  initial?: ActivityDTO | null;
  onClose: () => void;
  onSaved: () => void;
};

function initialParts(initial: ActivityDTO | null | undefined, fallbackDate: string) {
  if (!initial) {
    return {
      date: fallbackDate,
      startTime: "09:00",
      endTime: "10:00",
      timezone: "",
    };
  }
  const tz = initial.member.timezone;
  return {
    date: formatInTimeZone(initial.startAt, tz, "yyyy-MM-dd"),
    startTime: formatInTimeZone(initial.startAt, tz, "HH:mm"),
    endTime: formatInTimeZone(initial.endAt, tz, "HH:mm"),
    timezone: tz,
  };
}

export function ActivityForm({
  members,
  activities,
  currentMemberId,
  viewerTimezone,
  defaultDate,
  initial,
  onClose,
  onSaved,
}: Props) {
  const host = members.find((m) => m.id === currentMemberId);
  const parts = initialParts(initial, defaultDate);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [date, setDate] = useState(parts.date);
  const [startTime, setStartTime] = useState(parts.startTime);
  const [endTime, setEndTime] = useState(parts.endTime);
  const [allDay, setAllDay] = useState(initial?.allDay ?? false);
  const [timezone, setTimezone] = useState(parts.timezone || host?.timezone || "UTC");
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [allActivities, setAllActivities] = useState<ActivityDTO[]>(activities);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceSubmit, setForceSubmit] = useState(false);

  const others = members.filter((m) => m.id !== currentMemberId);

  useEffect(() => {
    // Load full busy data so conflicts include activities not yet visible on calendar
    void fetch(`/api/availability?start=${date}&end=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.activities) setAllActivities(data.activities);
      })
      .catch(() => setAllActivities(activities));
  }, [date, activities]);

  function toggleInvitee(id: string) {
    setInviteeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setForceSubmit(false);
  }

  const conflicts = useMemo(() => {
    if (inviteeIds.length === 0) return [];
    try {
      const { startAt, endAt } = proposedRangeUtc({
        date,
        startTime,
        endTime,
        allDay,
        timezone,
      });
      if (endAt <= startAt) return [];
      return findMemberConflicts({
        activities: allActivities,
        memberIds: inviteeIds,
        members,
        rangeStart: startAt,
        rangeEnd: endAt,
        excludeActivityId: initial?.id,
      });
    } catch {
      return [];
    }
  }, [
    inviteeIds,
    date,
    startTime,
    endTime,
    allDay,
    timezone,
    allActivities,
    members,
    initial?.id,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (conflicts.length > 0 && !forceSubmit) {
      setError(
        "One or more invited members are busy during this time. Review the reminder below, or click Save again to invite anyway.",
      );
      setForceSubmit(true);
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      title,
      description,
      date,
      startTime,
      endTime,
      allDay,
      timezone,
      inviteeIds: initial ? undefined : inviteeIds,
    };

    try {
      const res = await fetch(
        initial ? `/api/activities/${initial.id}` : "/api/activities",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save activity");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto animate-[rise_0.28s_ease] rounded-2xl bg-[var(--surface)] p-5 shadow-2xl ring-1 ring-black/5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
              {initial ? "Edit activity" : "Add activity"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Add your own plan, and optionally invite family members. Invited
              people only see it after they accept.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[var(--muted)] hover:bg-black/5"
          >
            Close
          </button>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-[var(--ink)]">Title</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none ring-[var(--accent)] focus:ring-2"
              placeholder="Dinner, flight, soccer practice…"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[var(--ink)]">Date</span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setForceSubmit(false);
                }}
                className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none ring-[var(--accent)] focus:ring-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[var(--ink)]">Timezone</span>
              <select
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  setForceSubmit(false);
                }}
                className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none ring-[var(--accent)] focus:ring-2"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => {
                setAllDay(e.target.checked);
                setForceSubmit(false);
              }}
            />
            All day
          </label>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-[var(--ink)]">Start</span>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setForceSubmit(false);
                  }}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none ring-[var(--accent)] focus:ring-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-[var(--ink)]">End</span>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setForceSubmit(false);
                  }}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none ring-[var(--accent)] focus:ring-2"
                />
              </label>
            </div>
          )}

          {!initial && others.length > 0 && (
            <div className="grid gap-2 text-sm">
              <span className="font-medium text-[var(--ink)]">
                Invite members (optional)
              </span>
              <div className="flex flex-wrap gap-2">
                {others.map((m) => {
                  const selected = inviteeIds.includes(m.id);
                  const conflicted = conflicts.some((c) => c.memberId === m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleInvitee(m.id)}
                      className="rounded-full px-3 py-1.5 text-sm transition"
                      style={{
                        backgroundColor: selected
                          ? conflicted
                            ? "rgba(180,83,9,0.15)"
                            : `${m.color}22`
                          : "rgba(0,0,0,0.03)",
                        boxShadow: selected
                          ? `inset 0 0 0 1px ${conflicted ? "#B45309" : m.color}`
                          : "inset 0 0 0 1px rgba(0,0,0,0.08)",
                        color: selected
                          ? conflicted
                            ? "#92400e"
                            : m.color
                          : "var(--muted)",
                      }}
                    >
                      {m.name}
                      {selected && conflicted ? " · busy" : ""}
                    </button>
                  );
                })}
              </div>
              {inviteeIds.length > 0 && (
                <p className="text-xs text-[var(--muted)]">
                  Invitation emails will be sent. The event stays hidden for
                  invitees until they accept.
                </p>
              )}
            </div>
          )}

          {conflicts.length > 0 && (
            <div
              className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950"
              role="status"
            >
              <p className="font-semibold">Busy overlap reminder</p>
              <p className="mt-1 text-xs text-amber-900/80">
                The time you picked overlaps existing activities for:
              </p>
              <ul className="mt-2 space-y-1.5">
                {conflicts.map((row) => (
                  <li key={row.memberId}>
                    <span className="font-medium" style={{ color: row.color }}>
                      {row.memberName}
                    </span>
                    <ul className="ml-3 list-disc text-xs text-amber-900/90">
                      {row.conflicts.map((c) => (
                        <li key={c.activityId}>
                          {formatConflictLabel(c, viewerTimezone)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              {forceSubmit && (
                <p className="mt-2 text-xs font-medium">
                  Click Save again to invite them anyway.
                </p>
              )}
            </div>
          )}

          {initial?.invites?.length ? (
            <div className="rounded-xl bg-black/[0.03] px-3 py-2 text-xs text-[var(--muted)]">
              Invites:{" "}
              {initial.invites
                .map((i) => `${i.memberName} (${i.status.toLowerCase()})`)
                .join(", ")}
            </div>
          ) : null}

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-[var(--ink)]">Notes</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none rounded-xl border border-black/10 bg-white px-3 py-2 outline-none ring-[var(--accent)] focus:ring-2"
              placeholder="Optional details"
            />
          </label>
        </div>

        {error && (
          <p className="mt-3 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-[var(--muted)] hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-deep)] disabled:opacity-60"
          >
            {saving
              ? "Saving…"
              : forceSubmit && conflicts.length > 0
                ? "Invite anyway"
                : initial
                  ? "Save changes"
                  : "Add activity"}
          </button>
        </div>
      </form>
    </div>
  );
}
