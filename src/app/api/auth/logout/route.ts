import { clearSharedCookies, noStoreJson } from "@/lib/auth";

export async function POST() {
  return clearSharedCookies(noStoreJson({ ok: true }));
}
