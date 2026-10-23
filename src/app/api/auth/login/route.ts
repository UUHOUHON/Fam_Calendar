import { z } from "zod";
import {
  clearSharedCookies,
  issueSession,
  noStoreJson,
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
    return noStoreJson({ error: "Invalid email or password" }, { status: 401 });
  }

  if (member.status === "REJECTED") {
    return noStoreJson(
      { error: "Your membership was rejected. Contact a family admin." },
      { status: 403 },
    );
  }

  const token = await issueSession(toSessionUser(member));
  const response = noStoreJson({
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status,
    },
    token,
  });
  return clearSharedCookies(response);
}
