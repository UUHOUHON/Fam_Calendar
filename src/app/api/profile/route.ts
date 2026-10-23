import { z } from "zod";
import {
  clearSharedCookies,
  issueSession,
  noStoreJson,
  requireSession,
  toSessionUser,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeMember } from "@/lib/serializers";
import { COMMON_TIMEZONES } from "@/lib/timezones";

const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  timezone: z.string().trim().min(1).optional(),
  color: z.string().trim().min(1).optional(),
});

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const body = schema.parse(await request.json());

    if (body.timezone) {
      const known = COMMON_TIMEZONES.some((t) => t.value === body.timezone);
      if (!body.timezone.includes("/")) {
        return noStoreJson({ error: "Invalid timezone" }, { status: 400 });
      }
      void known;
    }

    const member = await prisma.member.update({
      where: { id: session.id },
      data: {
        name: body.name,
        timezone: body.timezone,
        color: body.color,
      },
    });

    const token = await issueSession(toSessionUser(member));
    const response = noStoreJson({
      member: serializeMember(member),
      token,
    });
    return clearSharedCookies(response);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
