import { clearSessionOn, noStoreJson } from "@/lib/auth";

export async function POST() {
  const response = noStoreJson({ ok: true });
  return clearSessionOn(response);
}
