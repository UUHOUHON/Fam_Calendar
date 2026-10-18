import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSession,
  toSessionUser,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const member = await prisma.member.findUnique({
    where: { email: body.email.toLowerCase() },
  });

  if (!member || !(await verifyPassword(body.password, member.passwordHash))) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  if (member.status === "REJECTED") {
    return NextResponse.json(
      { error: "Your membership was rejected. Contact a family admin." },
      { status: 403 },
    );
  }

  await createSession(toSessionUser(member));

  return NextResponse.json({
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status,
    },
  });
}
