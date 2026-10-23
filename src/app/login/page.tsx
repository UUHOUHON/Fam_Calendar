"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { bindTabUser, clearTabUser } from "@/lib/tab-session";

type CurrentUser = {
  id: string;
  email: string;
  name: string;
  status: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<CurrentUser | null>(null);

  useEffect(() => {
    void fetch("/api/auth/me", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setCurrent(data.user);
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      clearTabUser();
      bindTabUser(data.member.id);
      router.push(data.member.status === "PENDING" ? "/pending" : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    clearTabUser();
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
    setCurrent(null);
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use the email you signed up with to open the family calendar."
    >
      {current && (
        <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
          This browser is already signed in as <strong>{current.email}</strong>.
          Sign out first to switch accounts, or continue to the calendar.
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() =>
                router.push(current.status === "PENDING" ? "/pending" : "/")
              }
              className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs text-white"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-black/5"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-deep)] disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Each browser keeps its own login. Two Chrome windows share one account;
        use a private window (or another browser/phone) for a second person.
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        New here?{" "}
        <Link href="/signup" className="font-medium text-[var(--accent)]">
          Sign up with email
        </Link>
      </p>
    </AuthShell>
  );
}
