"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";

type InvitePayload = {
  invite: { status: string; memberEmail: string };
  activity: { title: string; description: string; member: { name: string } };
  when: string;
  canRespond: boolean;
  needsLogin: boolean;
  error?: string;
};

function EventInviteForm() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [data, setData] = useState<InvitePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function load() {
    const res = await fetch(`/api/event-invites/${token}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Invitation not found");
      return;
    }
    setData(json);
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function respond(action: "accept" | "decline") {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/event-invites/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not respond");
      await load();
      if (action === "accept") {
        setTimeout(() => router.push("/"), 800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setWorking(false);
    }
  }

  if (error && !data) {
    return (
      <AuthShell title="Invitation unavailable" subtitle={error}>
        <Link href="/" className="text-sm font-medium text-[var(--accent)]">
          Back to calendar
        </Link>
      </AuthShell>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Loading invitation…
      </div>
    );
  }

  return (
    <AuthShell
      title={data.activity.title}
      subtitle={`${data.activity.member.name} invited you to plan this together.`}
    >
      <div className="rounded-2xl bg-black/[0.03] px-3 py-3 text-sm">
        <p className="font-medium text-[var(--ink)]">{data.when}</p>
        {data.activity.description && (
          <p className="mt-1 text-[var(--muted)]">{data.activity.description}</p>
        )}
        <p className="mt-2 text-xs text-[var(--muted)]">
          Status: {data.invite.status}
        </p>
      </div>

      {data.needsLogin && (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Sign in as <strong>{data.invite.memberEmail}</strong> to respond.{" "}
          <Link
            href={`/login`}
            className="font-medium text-[var(--accent)]"
          >
            Sign in
          </Link>
        </p>
      )}

      {data.canRespond && (
        <div className="mt-4 flex gap-2">
          <button
            disabled={working}
            onClick={() => void respond("accept")}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Accept
          </button>
          <button
            disabled={working}
            onClick={() => void respond("decline")}
            className="rounded-xl px-4 py-2 text-sm text-[var(--muted)] hover:bg-black/5 disabled:opacity-60"
          >
            Decline
          </button>
        </div>
      )}

      {data.invite.status === "ACCEPTED" && (
        <p className="mt-4 text-sm text-teal-800">
          Accepted — this event now appears on your calendar.
        </p>
      )}
      {data.invite.status === "DECLINED" && (
        <p className="mt-4 text-sm text-rose-700">You declined this invitation.</p>
      )}

      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

      <Link href="/" className="mt-5 inline-block text-sm text-[var(--accent)]">
        Open calendar
      </Link>
    </AuthShell>
  );
}

export default function EventInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
          Loading invitation…
        </div>
      }
    >
      <EventInviteForm />
    </Suspense>
  );
}
