"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  EmailLogDTO,
  FamilyInviteDTO,
  MemberDTO,
} from "@/lib/types";

export default function AdminPage() {
  const router = useRouter();
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [invites, setInvites] = useState<FamilyInviteDTO[]>([]);
  const [emails, setEmails] = useState<EmailLogDTO[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();
      if (!me.user) {
        router.replace("/login");
        return;
      }
      if (me.user.role !== "ADMIN" || me.user.status !== "ACTIVE") {
        router.replace("/");
        return;
      }

      const [membersRes, invitesRes, emailsRes] = await Promise.all([
        fetch("/api/admin/members"),
        fetch("/api/admin/invites"),
        fetch("/api/admin/emails"),
      ]);

      if (!membersRes.ok || !invitesRes.ok || !emailsRes.ok) {
        throw new Error("Failed to load admin data");
      }

      const membersJson = await membersRes.json();
      const invitesJson = await invitesRes.json();
      const emailsJson = await emailsRes.json();
      setMembers(membersJson.members);
      setInvites(invitesJson.invites);
      setEmails(emailsJson.emails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const res = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Invite failed");
      return;
    }
    setInviteEmail("");
    setMessage(
      data.email?.previewUrl
        ? `Invite emailed. Preview: ${data.email.previewUrl}`
        : `Invite sent to ${data.invite.email}`,
    );
    await load();
  }

  async function reviewMember(id: string, action: "accept" | "reject") {
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/admin/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Update failed");
      return;
    }
    setMessage(
      action === "accept"
        ? `${data.member.name} accepted — acceptance email sent.`
        : `${data.member.name} rejected.`,
    );
    await load();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Loading admin…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(15,118,110,0.16),_transparent_45%),linear-gradient(180deg,#f3efe6_0%,#eef3f1_100%)]" />
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800/80">
              Family admin
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
              The Family Calendar — Admin
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              Invite relatives by email, approve pending signups, and review
              outbound emails (Ethereal preview links while SMTP is not
              configured).
            </p>
          </div>
          <Link
            href="/"
            className="rounded-xl bg-white/80 px-3 py-2 text-sm ring-1 ring-black/5"
          >
            Back to calendar
          </Link>
        </header>

        {(message || error) && (
          <div
            className={`mb-4 rounded-2xl px-4 py-3 text-sm ${
              error ? "bg-rose-50 text-rose-800" : "bg-teal-50 text-teal-900"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-3xl bg-white/80 p-5 ring-1 ring-black/5">
            <h2 className="font-[family-name:var(--font-display)] text-xl">
              Invite by email
            </h2>
            <form onSubmit={(e) => void sendInvite(e)} className="mt-3 flex gap-2">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="cousin@email.com"
                className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
              />
              <button
                type="submit"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Send invite
              </button>
            </form>

            <ul className="mt-4 space-y-2">
              {invites.length === 0 && (
                <li className="text-sm text-[var(--muted)]">No invites yet.</li>
              )}
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="rounded-2xl bg-black/[0.03] px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{invite.email}</span>
                    <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      {invite.status}
                    </span>
                  </div>
                  <a
                    href={`/signup?invite=${invite.token}`}
                    className="mt-1 block truncate text-xs text-[var(--accent)]"
                  >
                    /signup?invite={invite.token}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl bg-white/80 p-5 ring-1 ring-black/5">
            <h2 className="font-[family-name:var(--font-display)] text-xl">
              Pending & members
            </h2>
            <ul className="mt-4 space-y-2">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-black/[0.03] px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: member.color }}
                      />
                      {member.name}
                      {member.role === "ADMIN" && (
                        <span className="ml-2 text-xs text-teal-800">admin</span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {member.email} · {member.status}
                    </div>
                  </div>
                  {member.status === "PENDING" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => void reviewMember(member.id, "accept")}
                        className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs text-white"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => void reviewMember(member.id, "reject")}
                        className="rounded-lg px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl bg-white/80 p-5 ring-1 ring-black/5 lg:col-span-2">
            <h2 className="font-[family-name:var(--font-display)] text-xl">
              Email outbox
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Signup, invite, and approval emails are sent through Brevo. A
              FAILED row means Brevo rejected the message.
            </p>
            <ul className="mt-4 space-y-2">
              {emails.length === 0 && (
                <li className="text-sm text-[var(--muted)]">No emails yet.</li>
              )}
              {emails.map((email) => (
                <li
                  key={email.id}
                  className="rounded-2xl bg-black/[0.03] px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{email.subject}</div>
                      <div className="text-xs text-[var(--muted)]">
                        To {email.to} · {email.status} ·{" "}
                        {new Date(email.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {email.previewUrl && (
                      <a
                        href={email.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-950"
                      >
                        Open email preview
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
