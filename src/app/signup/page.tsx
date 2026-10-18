"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { bindTabUser } from "@/lib/tab-session";
import { COMMON_TIMEZONES } from "@/lib/timezones";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteToken = params.get("invite") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [inviteInfo, setInviteInfo] = useState<{
    familyName: string;
    invitedByName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  }, []);

  useEffect(() => {
    if (!inviteToken) return;
    void fetch(`/api/invites/${inviteToken}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Invalid invite");
        setEmail(data.email);
        setInviteInfo({
          familyName: data.familyName,
          invitedByName: data.invitedByName,
        });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Invalid invite"),
      );
  }, [inviteToken]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          timezone,
          inviteToken: inviteToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      bindTabUser(data.member.id);
      if (data.emailSent === false) {
        sessionStorage.setItem(
          "fam_mail_error",
          data.emailError || "Confirmation email could not be sent.",
        );
      } else {
        sessionStorage.removeItem("fam_mail_error");
      }
      router.push(data.member.status === "PENDING" ? "/pending" : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Sign up with email"
      subtitle={
        inviteInfo
          ? `${inviteInfo.invitedByName} invited you to ${inviteInfo.familyName}.`
          : "Create your account. An admin will approve new members."
      }
    >
      <form onSubmit={onSubmit} className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Name</span>
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
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={!!inviteToken}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none ring-[var(--accent)] focus:ring-2 read-only:bg-black/[0.03]"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none ring-[var(--accent)] focus:ring-2"
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
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-deep)] disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--accent)]">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
          Loading…
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
