"use client";

import { useState } from "react";
import type { MemberDTO } from "@/lib/types";
import { COMMON_TIMEZONES } from "@/lib/timezones";

type Props = {
  me: MemberDTO;
  onClose: () => void;
  onSaved: () => void;
};

export function ProfileForm({ me, onClose, onSaved }: Props) {
  const [name, setName] = useState(me.name);
  const [timezone, setTimezone] = useState(me.timezone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update profile");
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
        className="w-full max-w-md animate-[rise_0.28s_ease] rounded-2xl bg-[var(--surface)] p-5 shadow-2xl ring-1 ring-black/5"
      >
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Edit profile
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Update the name others see on the family calendar.
        </p>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Display name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none ring-[var(--accent)] focus:ring-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input
              value={me.email}
              readOnly
              className="rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 text-[var(--muted)]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Timezone</span>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none ring-[var(--accent)] focus:ring-2"
            >
              {!COMMON_TIMEZONES.some((t) => t.value === timezone) && (
                <option value={timezone}>{timezone}</option>
              )}
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

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
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-deep)] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
