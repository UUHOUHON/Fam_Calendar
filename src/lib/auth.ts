import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

/** Bumped cookie name so old shared/cached sessions are dropped. */
export const SESSION_COOKIE = "fam_sid";

const secret = () =>
  new TextEncoder().encode(
    process.env.AUTH_SECRET || "fam-calendar-dev-secret-change-me",
  );

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  familyId: string;
  timezone: string;
  color: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    familyId: user.familyId,
    timezone: user.timezone,
    color: user.color,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .setJti(`${user.id}-${Date.now()}`)
    .sign(secret());
}

/** Attach session cookie to a Route Handler response (preferred). */
export async function attachSession(
  response: NextResponse,
  user: SessionUser,
) {
  const token = await createSessionToken(user);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  // Clear legacy cookie if present
  response.cookies.set("fam_session", "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}

export async function clearSessionOn(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  response.cookies.set("fam_session", "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}

/** @deprecated Prefer attachSession on the response. */
export async function createSession(user: SessionUser) {
  const token = await createSessionToken(user);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
  jar.set("fam_session", "", { ...sessionCookieOptions(), maxAge: 0 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  jar.set("fam_session", "", { ...sessionCookieOptions(), maxAge: 0 });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token =
    jar.get(SESSION_COOKIE)?.value || jar.get("fam_session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    const id = String(payload.id || "");
    if (!id) return null;

    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) return null;

    return {
      id: member.id,
      email: member.email,
      name: member.name,
      role: member.role,
      status: member.status,
      familyId: member.familyId,
      timezone: member.timezone,
      color: member.color,
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
      },
    });
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "ADMIN" || session.status !== "ACTIVE") {
    throw new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
      },
    });
  }
  return session;
}

export function toSessionUser(member: {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  familyId: string;
  timezone: string;
  color: string;
}): SessionUser {
  return {
    id: member.id,
    email: member.email,
    name: member.name,
    role: member.role,
    status: member.status,
    familyId: member.familyId,
    timezone: member.timezone,
    color: member.color,
  };
}

export function noStoreJson(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Vary: "Cookie",
    },
  });
}
