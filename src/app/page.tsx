import { Suspense } from "react";
import { CalendarApp } from "@/components/CalendarApp";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
          Loading family calendar…
        </div>
      }
    >
      <CalendarApp />
    </Suspense>
  );
}
