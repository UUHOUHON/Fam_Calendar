"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { clearTabUser } from "@/lib/tab-session";

export default function PendingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mailError, setMailError] = useState<string | null>(null);

  useEffect(() => {
    setMailError(sessionStorage.getItem("fam_mail_error"));
    void fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.replace("/login");
          return;
        }
        if (data.user.status === "ACTIVE") {
          router.replace("/");
          return;
        }
        setName(data.user.name);
      });
  }, [router]);

  async function logout() {
    clearTabUser();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <AuthShell
      title="Waiting for approval"
      subtitle="We emailed you a signup confirmation. A family admin still needs to accept your membership — you'll get another email when that happens."
    >
      {mailError && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Your account was created, but the confirmation email was not sent (
          {mailError}). An admin can still approve you.
        </p>
      )}
      <p className="text-sm text-[var(--ink)]">
        Hang tight{name ? `, ${name}` : ""}. You can close this tab and come back
        after you&apos;re accepted.
      </p>
      <div className="mt-5 flex gap-2">
        <Link
          href="/login"
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Check again
        </Link>
        <button
          onClick={() => void logout()}
          className="rounded-xl px-4 py-2 text-sm text-[var(--muted)] hover:bg-black/5"
        >
          Sign out
        </button>
      </div>
    </AuthShell>
  );
}
