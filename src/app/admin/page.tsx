"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  EmailLogDTO,
  FamilyInviteDTO,
  MemberDTO,
} from "@/lib/types";
import { apiFetch, getTabToken } from "@/lib/tab-session";

type Me = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [invites, setInvites] = useState<FamilyInviteDTO[]>([]);
  const [emails, setEmails] = useState<EmailLogDTO[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (!getTabToken()) {
        router.replace("/login");
        return;
      }
      const meRes = await apiFetch("/api/auth/me");
      const meJson = await meRes.json();
      if (!meJson.user) {
        router.replace("/login");
        return;
      }
      if (meJson.user.role !== "ADMIN" || meJson.user.status !== "ACTIVE") {
        router.replace("/");
        return;
      }
      setMe(meJson.user);

      const [membersRes, invitesRes, emailsRes] = await Promise.all([
        apiFetch("/api/admin/members"),
        apiFetch("/api/admin/invites"),
        apiFetch("/api/admin/emails"),
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
    const res = await apiFetch("/api/admin/invites", {
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
    const absoluteLink =
      data.invite?.link?.startsWith("http")
        ? data.invite.link
        : `${window.location.origin}/signup?invite=${data.invite.token}`;
    setLastInviteLink(absoluteLink);

    if (data.email?.ok) {
      setMessage(`Invite emailed to ${data.invite.email}.`);
    } else {
      setError(
        `Invite created for ${data.invite.email}, but email was not sent${
          data.email?.error ? ` (${data.email.error})` : ""
        }. Copy the invite link below and share it manually.`,
      );
    }
    await load();
  }

  async function copyInviteLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Invite link copied.");
      setError(null);
    } catch {
      setError("Could not copy automatically — select the link and copy it.");
    }
  }

  async function reviewMember(id: string, action: "accept" | "reject") {
    setMessage(null);
    setError(null);
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/admin/members/${id}`, {
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
    } finally {
      setBusyId(null);
    }
  }

  function startRename(member: MemberDTO) {
    setEditingId(member.id);
    setEditName(member.name);
    setMessage(null);
    setError(null);
  }

  async function saveRename(id: string) {
    const name = editName.trim();
    if (!name) {
      setError("Name cannot be empty");
      return;
    }
    setBusyId(id);
    setMessage(null);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not rename member");
        return;
      }
      setEditingId(null);
      setMessage(`Renamed to ${data.member.name}.`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function setRole(id: string, role: "ADMIN" | "MEMBER") {
    setBusyId(id);
    setMessage(null);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update role");
        return;
      }
      setMessage(
        role === "ADMIN"
          ? `${data.member.name} is now an admin.`
          : `${data.member.name} is now a member.`,
      );
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(member: MemberDTO) {
    if (member.id === me?.id) {
      setError("You cannot remove your own account");
      return;
    }
    if (
      !confirm(
        `Remove ${member.name} (${member.email}) from the family calendar? Their activities will be deleted.`,
      )
    ) {
      return;
    }
    setBusyId(member.id);
    setMessage(null);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/members/${member.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not remove member");
        return;
      }
      setMessage(`${member.name} was removed.`);
      await load();
    } finally {
      setBusyId(null);
    }
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
              Invite relatives, approve signups, rename or remove members, and
              review outbound emails.
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

            {lastInviteLink && (
              <div className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <div className="font-medium">Latest invite link</div>
                <p className="mt-1 break-all text-xs">{lastInviteLink}</p>
                <button
                  type="button"
                  onClick={() => void copyInviteLink(lastInviteLink)}
                  className="mt-2 rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs text-white"
                >
                  Copy link
                </button>
              </div>
            )}

            <ul className="mt-4 space-y-2">
              {invites.length === 0 && (
                <li className="text-sm text-[var(--muted)]">No invites yet.</li>
              )}
              {invites.map((invite) => {
                const link = `${window.location.origin}/signup?invite=${invite.token}`;
                return (
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
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <a
                        href={link}
                        className="block min-w-0 flex-1 truncate text-xs text-[var(--accent)]"
                      >
                        {link}
                      </a>
                      <button
                        type="button"
                        onClick={() => void copyInviteLink(link)}
                        className="rounded-lg bg-white px-2 py-0.5 text-xs ring-1 ring-black/10"
                      >
                        Copy
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-3xl bg-white/80 p-5 ring-1 ring-black/5">
            <h2 className="font-[family-name:var(--font-display)] text-xl">
              Pending & members
            </h2>
            <ul className="mt-4 space-y-3">
              {members.map((member) => {
                const isSelf = member.id === me?.id;
                const busy = busyId === member.id;
                const editing = editingId === member.id;

                return (
                  <li
                    key={member.id}
                    className="rounded-2xl bg-black/[0.03] px-3 py-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {editing ? (
                          <div className="flex flex-wrap gap-2">
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="min-w-0 flex-1 rounded-lg border border-black/10 px-2 py-1 text-sm outline-none ring-[var(--accent)] focus:ring-2"
                              autoFocus
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void saveRename(member.id)}
                              className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs text-white disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setEditingId(null)}
                              className="rounded-lg px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-black/5"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="font-medium">
                            <span
                              className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: member.color }}
                            />
                            {member.name}
                            {member.role === "ADMIN" && (
                              <span className="ml-2 text-xs text-teal-800">
                                admin
                              </span>
                            )}
                            {isSelf && (
                              <span className="ml-2 text-xs text-[var(--muted)]">
                                you
                              </span>
                            )}
                          </div>
                        )}
                        <div className="mt-0.5 text-xs text-[var(--muted)]">
                          {member.email} · {member.status} · {member.timezone}
                        </div>
                      </div>

                      {member.status === "PENDING" && (
                        <div className="flex gap-1">
                          <button
                            disabled={busy}
                            onClick={() =>
                              void reviewMember(member.id, "accept")
                            }
                            className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs text-white disabled:opacity-60"
                          >
                            Accept
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void reviewMember(member.id, "reject")
                            }
                            className="rounded-lg px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>

                    {member.status !== "REJECTED" && !editing && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startRename(member)}
                          className="rounded-lg bg-white px-2.5 py-1 text-xs ring-1 ring-black/10 hover:bg-black/[0.03] disabled:opacity-60"
                        >
                          Rename
                        </button>
                        {member.status === "ACTIVE" &&
                          member.role !== "ADMIN" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void setRole(member.id, "ADMIN")}
                              className="rounded-lg bg-white px-2.5 py-1 text-xs ring-1 ring-black/10 hover:bg-black/[0.03] disabled:opacity-60"
                            >
                              Make admin
                            </button>
                          )}
                        {member.status === "ACTIVE" &&
                          member.role === "ADMIN" &&
                          !isSelf && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void setRole(member.id, "MEMBER")}
                              className="rounded-lg bg-white px-2.5 py-1 text-xs ring-1 ring-black/10 hover:bg-black/[0.03] disabled:opacity-60"
                            >
                              Make member
                            </button>
                          )}
                        {!isSelf && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeMember(member)}
                            className="rounded-lg px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
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
