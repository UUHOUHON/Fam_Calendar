import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

/** Legacy cookie — cleared so windows no longer share login. */
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
    .setJti(`${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    .sign(secret());
}

/** Clear shared browser cookies so each window uses its own Bearer token. */
export function clearSharedCookies(response: NextResponse) {
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

export async function issueSession(user: SessionUser) {
  return createSessionToken(user);
}

/** @deprecated Prefer issueSession + token in JSON. */
export async function attachSession(
  response: NextResponse,
  user: SessionUser,
) {
  const token = await createSessionToken(user);
  clearSharedCookies(response);
  response.headers.set("X-Fam-Token", token);
  return response;
}

export async function clearSessionOn(response: NextResponse) {
  return clearSharedCookies(response);
}

export async function createSession(user: SessionUser) {
  void user;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  jar.set("fam_session", "", { ...sessionCookieOptions(), maxAge: 0 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  jar.set("fam_session", "", { ...sessionCookieOptions(), maxAge: 0 });
}

async function memberFromToken(token: string): Promise<SessionUser | null> {
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

export async function getSession(): Promise<SessionUser | null> {
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) {
      const fromBearer = await memberFromToken(token);
      if (fromBearer) return fromBearer;
    }
  }

  // Cookie fallback only if no Bearer (older tabs); prefer Bearer for isolation.
  const jar = await cookies();
  const cookieToken =
    jar.get(SESSION_COOKIE)?.value || jar.get("fam_session")?.value;
  if (!cookieToken) return null;
  return memberFromToken(cookieToken);
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
      Vary: "Authorization, Cookie",
    },
  });
}
