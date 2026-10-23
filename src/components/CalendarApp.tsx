"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  format,
  isSameMonth,
  parseISO,
  subMonths,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  activitiesForViewerDay,
  buildDayAlignment,
  describeActivityInZones,
  findBusyOverlaps,
  findFreeOverlapsForDay,
} from "@/lib/alignment";
import {
  dayKeyInZone,
  getCalendarGrid,
  localDayBoundsUtc,
  monthLabel,
  utcToZonedParts,
} from "@/lib/datetime";
import type { ActivityDTO, FamilyBundle, MemberDTO } from "@/lib/types";
import {
  apiFetch,
  bindTabUser,
  clearTabSession,
  getTabToken,
} from "@/lib/tab-session";
import { ActivityForm } from "./ActivityForm";
import { AvailabilityPanel } from "./AvailabilityPanel";
import { ProfileForm } from "./ProfileForm";

export function CalendarApp() {
  const router = useRouter();
  const [data, setData] = useState<FamilyBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [visibleMembers, setVisibleMembers] = useState<string[]>([]);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editing, setEditing] = useState<ActivityDTO | null>(null);
  const [ready, setReady] = useState(false);

  async function load(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      if (!getTabToken()) {
        router.replace("/login");
        return;
      }
      const meRes = await apiFetch("/api/auth/me");
      const meJson = await meRes.json();
      if (!meJson.user) {
        clearTabSession();
        router.replace("/login");
        return;
      }
      bindTabUser(meJson.user.id);
      if (meJson.user.status === "PENDING") {
        router.replace("/pending");
        return;
      }

      const res = await apiFetch("/api/family");
      if (res.status === 401) {
        clearTabSession();
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load family calendar");
      const json = (await res.json()) as FamilyBundle;
      setData(json);
      setVisibleMembers((prev) =>
        prev.length
          ? prev.filter((id) => json.members.some((m) => m.id === id))
          : json.members.map((m) => m.id),
      );
    } catch (err) {
      if (!opts?.silent) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  useEffect(() => {
    const now = new Date();
    setMonth(now);
    setSelectedDay(format(now, "yyyy-MM-dd"));
    setReady(true);
    void load();

    // Keep calendars in sync across family members without a full page reload.
    const pollId = window.setInterval(() => {
      void load({ silent: true });
    }, 12_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const me: MemberDTO | null = data?.me ?? null;
  const viewerTz = me?.timezone ?? "UTC";

  const filteredActivities = useMemo(() => {
    if (!data) return [];
    return data.activities.filter((a) => {
      if (visibleMembers.includes(a.memberId)) return true;
      // Shared plans where another host invited someone still show if visible via invites
      return a.invites.some(
        (i) =>
          visibleMembers.includes(i.memberId) && i.status === "ACCEPTED",
      );
    });
  }, [data, visibleMembers]);

  const grid = useMemo(() => (month ? getCalendarGrid(month) : []), [month]);

  const activitiesByDay = useMemo(() => {
    const map = new Map<string, ActivityDTO[]>();
    for (const day of grid) {
      const key = format(day, "yyyy-MM-dd");
      map.set(key, activitiesForViewerDay(filteredActivities, key, viewerTz));
    }
    return map;
  }, [filteredActivities, grid, viewerTz]);

  const dayActivities = useMemo(
    () =>
      selectedDay
        ? activitiesForViewerDay(filteredActivities, selectedDay, viewerTz)
        : [],
    [filteredActivities, selectedDay, viewerTz],
  );

  const alignment = useMemo(() => {
    if (!data || !me || !selectedDay) return null;
    return buildDayAlignment(selectedDay, viewerTz, data.members);
  }, [data, selectedDay, me, viewerTz]);

  const freeOverlaps = useMemo(() => {
    if (!data || !selectedDay) return [];
    return findFreeOverlapsForDay(
      selectedDay,
      viewerTz,
      data.members,
      filteredActivities,
      visibleMembers,
    );
  }, [data, selectedDay, viewerTz, filteredActivities, visibleMembers]);

  const busyOverlaps = useMemo(() => {
    if (!selectedDay) return [];
    const { start, end } = localDayBoundsUtc(selectedDay, viewerTz);
    return findBusyOverlaps(filteredActivities, start, end);
  }, [filteredActivities, selectedDay, viewerTz]);

  async function deleteActivity(id: string) {
    if (!confirm("Delete this activity?")) return;
    await apiFetch(`/api/activities/${id}`, { method: "DELETE" });
    await load();
  }

  async function logout() {
    clearTabSession();
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function toggleMember(id: string) {
    setVisibleMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  if (!ready || loading || !month || !selectedDay) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Loading family calendar…
      </div>
    );
  }

  if (error || !data || !me) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-rose-700">{error ?? "Something went wrong"}</p>
        <button
          onClick={() => void load()}
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const todayKey = dayKeyInZone(new Date(), viewerTz);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(15,118,110,0.18),_transparent_45%),radial-gradient(ellipse_at_bottom_right,_rgba(180,83,9,0.14),_transparent_40%),linear-gradient(180deg,#f3efe6_0%,#e7eef0_55%,#f7f4ee_100%)]" />
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-teal-700/10 blur-3xl animate-[drift_12s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-amber-700/10 blur-3xl animate-[drift_14s_ease-in-out_infinite_reverse]" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-black/5 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="animate-[fadeup_0.5s_ease]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-800/80">
              Shared across time zones
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl text-[var(--ink)] sm:text-5xl">
              The Family Calendar
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[var(--muted)] sm:text-base">
              Signed in as <strong>{me.name}</strong> ({me.email}). Times use
              your timezone ({me.timezone.replace("_", " ")}). Invite others when
              you add an activity — they only see it after accepting.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 animate-[fadeup_0.55s_ease]">
            {me.role === "ADMIN" && (
              <Link
                href="/admin"
                className="rounded-xl bg-white/70 px-3 py-2 text-sm font-medium ring-1 ring-black/5 backdrop-blur hover:bg-white"
              >
                Admin
              </Link>
            )}
            <button
              onClick={() => setShowProfile(true)}
              className="rounded-xl bg-white/70 px-3 py-2 text-sm font-medium ring-1 ring-black/5 backdrop-blur hover:bg-white"
            >
              Edit name
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setShowActivityForm(true);
              }}
              className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--accent-deep)]"
            >
              Add activity
            </button>
            <button
              onClick={() => void logout()}
              className="rounded-xl px-3 py-2 text-sm text-[var(--muted)] hover:bg-black/5"
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="flex flex-wrap gap-2 animate-[fadeup_0.6s_ease]">
          {data.members.map((m) => {
            const active = visibleMembers.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggleMember(m.id)}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition"
                style={{
                  backgroundColor: active ? `${m.color}22` : "rgba(255,255,255,0.55)",
                  color: active ? m.color : "var(--muted)",
                  boxShadow: active
                    ? `inset 0 0 0 1px ${m.color}`
                    : "inset 0 0 0 1px rgba(0,0,0,0.06)",
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                {m.name}
                <span className="text-xs opacity-70">
                  {m.timezone.replace("_", " ").split("/").pop()}
                </span>
              </button>
            );
          })}
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.9fr)]">
          <section className="rounded-3xl bg-white/70 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur sm:p-5 animate-[fadeup_0.65s_ease]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
                {monthLabel(month)}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setMonth((m) => (m ? subMonths(m, 1) : new Date()))
                  }
                  className="rounded-lg px-3 py-1.5 text-sm hover:bg-black/5"
                >
                  Prev
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    setMonth(now);
                    setSelectedDay(dayKeyInZone(now, viewerTz));
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm hover:bg-black/5"
                >
                  Today
                </button>
                <button
                  onClick={() =>
                    setMonth((m) => (m ? addMonths(m, 1) : new Date()))
                  }
                  className="rounded-lg px-3 py-1.5 text-sm hover:bg-black/5"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {grid.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const items = activitiesByDay.get(key) ?? [];
                const selected = key === selectedDay;
                const isToday = key === todayKey;
                const inMonth = isSameMonth(day, month);
                const memberIds = Array.from(
                  new Set(items.map((a) => a.memberId)),
                );

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(key)}
                    className={`min-h-[88px] rounded-2xl border p-2 text-left transition sm:min-h-[104px] ${
                      selected
                        ? "border-teal-700/40 bg-teal-50 shadow-sm"
                        : "border-transparent bg-white/40 hover:bg-white/80"
                    } ${inMonth ? "" : "opacity-40"}`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                          isToday
                            ? "bg-[var(--accent)] text-white"
                            : "text-[var(--ink)]"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                      {memberIds.length > 1 && (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                          align
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {memberIds.slice(0, 4).map((id) => {
                        const m = data.members.find((x) => x.id === id);
                        return (
                          <span
                            key={id}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: m?.color }}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {items.slice(0, 2).map((a) => (
                        <div
                          key={a.id}
                          className="truncate text-[11px] font-medium"
                          style={{ color: a.member.color }}
                        >
                          {a.title}
                        </div>
                      ))}
                      {items.length > 2 && (
                        <div className="text-[10px] text-[var(--muted)]">
                          +{items.length - 2} more
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="flex flex-col gap-4 animate-[fadeup_0.7s_ease]">
            <section className="rounded-3xl bg-white/75 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur sm:p-5">
              <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                {formatInTimeZone(
                  parseISO(`${selectedDay}T12:00:00`),
                  viewerTz,
                  "EEEE, MMMM d",
                )}
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Shown in your timezone ({viewerTz.replace("_", " ")})
              </p>

              <div className="mt-4 space-y-3">
                {dayActivities.length === 0 && (
                  <p className="rounded-2xl bg-black/[0.03] px-3 py-4 text-sm text-[var(--muted)]">
                    No visible activities on this day.
                  </p>
                )}
                {dayActivities.map((activity) => {
                  const zones = describeActivityInZones(activity, viewerTz);
                  const pendingInvites = activity.invites.filter(
                    (i) => i.status === "PENDING",
                  );
                  return (
                    <article
                      key={activity.id}
                      className="rounded-2xl border border-black/5 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: activity.member.color }}
                            />
                            <h4 className="font-semibold text-[var(--ink)]">
                              {activity.title}
                            </h4>
                          </div>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {activity.member.name} · your time: {zones.viewerRange}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            Their local: {zones.ownerRange}
                            {zones.crossesViewerDay ? " · crosses your day" : ""}
                          </p>
                          {activity.invites.length > 0 && (
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              Invites:{" "}
                              {activity.invites
                                .map(
                                  (i) =>
                                    `${i.memberName} (${i.status.toLowerCase()})`,
                                )
                                .join(", ")}
                            </p>
                          )}
                          {pendingInvites.length > 0 &&
                            activity.memberId === me.id && (
                              <p className="mt-1 text-xs text-amber-800">
                                Waiting for {pendingInvites.length} acceptance
                                {pendingInvites.length > 1 ? "s" : ""}. Hidden
                                from invitees until they accept.
                              </p>
                            )}
                          {activity.description && (
                            <p className="mt-2 text-sm text-[var(--ink)]/80">
                              {activity.description}
                            </p>
                          )}
                        </div>
                        {(activity.memberId === me.id || me.role === "ADMIN") && (
                          <div className="flex shrink-0 gap-1">
                            <button
                              onClick={() => {
                                setEditing(activity);
                                setShowActivityForm(true);
                              }}
                              className="rounded-lg px-2 py-1 text-xs text-[var(--muted)] hover:bg-black/5"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => void deleteActivity(activity.id)}
                              className="rounded-lg px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <AvailabilityPanel
              members={data.members}
              viewerTimezone={viewerTz}
              defaultStart={selectedDay}
            />

            <section className="rounded-3xl bg-[var(--ink)] p-4 text-[var(--cream)] shadow-sm sm:p-5">
              <h3 className="font-[family-name:var(--font-display)] text-xl">
                Day alignment
              </h3>
              <p className="mt-1 text-sm text-white/70">
                Your selected day as it lands for each family member.
              </p>
              <ul className="mt-4 space-y-2">
                {alignment?.members.map((m) => (
                  <li
                    key={m.memberId}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white/8 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: m.color }}
                      />
                      <div>
                        <div className="text-sm font-medium">{m.memberName}</div>
                        <div className="text-xs text-white/60">
                          {m.timezone.replace("_", " ")} · UTC{m.offsetLabel}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{m.localWeekday}</div>
                      <div className="text-xs text-white/70">{m.localDate}</div>
                      {m.isSameCalendarDay ? (
                        <span className="mt-1 inline-block rounded bg-teal-300/20 px-1.5 py-0.5 text-[10px] text-teal-100">
                          same date
                        </span>
                      ) : (
                        <span className="mt-1 inline-block rounded bg-amber-300/20 px-1.5 py-0.5 text-[10px] text-amber-100">
                          shifted day
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl bg-white/75 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur sm:p-5">
              <h3 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
                Shared windows
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Free overlap for visible members, plus busy conflicts in real
                time.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                    Free together
                  </h4>
                  {freeOverlaps.length === 0 ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      No 1h+ free overlap today for the selected members.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {freeOverlaps.map((w) => (
                        <li
                          key={`${w.startAt}-${w.endAt}`}
                          className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-950"
                        >
                          {utcToZonedParts(w.startAt, viewerTz).shortLabel} –{" "}
                          {utcToZonedParts(w.endAt, viewerTz).shortLabel}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    Busy overlap
                  </h4>
                  {busyOverlaps.length === 0 ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      No overlapping activities between members today.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {busyOverlaps.map((w) => {
                        const names = w.memberIds
                          .map(
                            (id) =>
                              data.members.find((m) => m.id === id)?.name ??
                              "Member",
                          )
                          .join(" + ");
                        return (
                          <li
                            key={`${w.startAt}-${w.endAt}-${names}`}
                            className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950"
                          >
                            {names}:{" "}
                            {utcToZonedParts(w.startAt, viewerTz).shortLabel} –{" "}
                            {utcToZonedParts(w.endAt, viewerTz).shortLabel}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {showActivityForm && (
        <ActivityForm
          members={data.members}
          activities={data.activities}
          currentMemberId={me.id}
          viewerTimezone={viewerTz}
          defaultDate={selectedDay}
          initial={editing}
          onClose={() => {
            setShowActivityForm(false);
            setEditing(null);
          }}
          onSaved={() => void load()}
        />
      )}

      {showProfile && (
        <ProfileForm
          me={me}
          onClose={() => setShowProfile(false)}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}
