import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(15,118,110,0.18),_transparent_45%),radial-gradient(ellipse_at_bottom_right,_rgba(180,83,9,0.14),_transparent_40%),linear-gradient(180deg,#f3efe6_0%,#e7eef0_55%,#f7f4ee_100%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <Link
          href="/"
          className="mb-6 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]"
        >
          The Family Calendar
        </Link>
        <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 backdrop-blur">
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            {title}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
