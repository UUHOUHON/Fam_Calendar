import { getSession, noStoreJson } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  return noStoreJson({ user: session });
}
