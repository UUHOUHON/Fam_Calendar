"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { utcToZonedParts } from "@/lib/datetime";
import type { DayAvailability } from "@/lib/availability";
import type { MemberDTO } from "@/lib/types";

type Props = {
  members: MemberDTO[];
  viewerTimezone: string;
  defaultStart: string;
};

export function AvailabilityPanel({
  members,
  viewerTimezone,
  defaultStart,
}: Props) {
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(() =>
    format(addDays(new Date(`${defaultStart}T12:00:00`), 6), "yyyy-MM-dd"),
  );
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(opts?: { silent?: boolean }) {
    if (!startDate || !endDate) return;
    if (endDate < startDate) {
      setError("End date must be on or after the start date");
      return;
    }
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/availability?start=${startDate}&end=${endDate}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load availability");
      setDays(data.days);
    } catch (err) {
      if (!opts?.silent) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const pollId = window.setInterval(() => {
      void load({ silent: true });
    }, 20_000);
    return () => window.clearInterval(pollId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const summary = useMemo(() => {
    return members.map((member) => {
      const busyDays = days.filter((d) =>
        d.members.some((m) => m.memberId === member.id && m.busy),
      ).length;
      const freeDays = days.length - busyDays;
      return { member, busyDays, freeDays };
    });
  }, [days, members]);

  return (
    <section className="rounded-3xl bg-white/75 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur sm:p-5">
      <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
        Who&apos;s free
      </h3>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Pick a date range to see who is free or busy each day (in your
        timezone).
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs">
          <span className="font-medium text-[var(--ink)]">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-2 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="font-medium text-[var(--ink)]">To</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-2 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>
      </div>
      <button
        onClick={() => void load()}
        disabled={loading}
        className="mt-2 w-full rounded-xl bg-[var(--ink)] px-3 py-2 text-sm font-medium text-[var(--cream)] disabled:opacity-60"
      >
        {loading ? "Checking…" : "Check availability"}
      </button>

      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}

      {days.length > 0 && (
        <>
          <div className="mt-4 space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Summary
            </h4>
            {summary.map(({ member, busyDays, freeDays }) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-xl bg-black/[0.03] px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: member.color }}
                  />
                  {member.name}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  <span className="text-teal-800">{freeDays} free</span>
                  {" · "}
                  <span className="text-amber-800">{busyDays} busy</span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
            {days.map((day) => (
              <div
                key={day.date}
                className="rounded-2xl border border-black/5 bg-white px-3 py-2"
              >
                <div className="text-sm font-semibold text-[var(--ink)]">
                  {format(new Date(`${day.date}T12:00:00`), "EEE, MMM d")}
                </div>
                <ul className="mt-1.5 space-y-1">
                  {day.members.map((m) => (
                    <li key={m.memberId} className="text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span style={{ color: m.color }} className="font-medium">
                          {m.memberName}
                        </span>
                        <span
                          className={
                            m.busy
                              ? "rounded bg-amber-100 px-1.5 py-0.5 text-amber-900"
                              : "rounded bg-teal-100 px-1.5 py-0.5 text-teal-900"
                          }
                        >
                          {m.busy ? "Busy" : "Free"}
                        </span>
                      </div>
                      {m.busy &&
                        m.blocks.map((b) => (
                          <div
                            key={b.activityId}
                            className="mt-0.5 text-[11px] text-[var(--muted)]"
                          >
                            {b.title}:{" "}
                            {utcToZonedParts(b.startAt, viewerTimezone).shortLabel}{" "}
                            –{" "}
                            {utcToZonedParts(b.endAt, viewerTimezone).shortLabel}
                          </div>
                        ))}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
