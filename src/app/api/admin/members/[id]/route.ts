import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  appBaseUrl,
  memberAcceptedHtml,
  sendEmail,
} from "@/lib/email";
import { serializeMember } from "@/lib/serializers";

const schema = z.object({
  action: z.enum(["accept", "reject"]),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const { action } = schema.parse(await request.json());

    const member = await prisma.member.findFirst({
      where: { id, familyId: admin.familyId },
    });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (member.role === "ADMIN" && action === "reject") {
      return NextResponse.json(
        { error: "Cannot reject an admin" },
        { status: 400 },
      );
    }

    const updated = await prisma.member.update({
      where: { id },
      data: { status: action === "accept" ? "ACTIVE" : "REJECTED" },
    });

    const family = await prisma.family.findUniqueOrThrow({
      where: { id: admin.familyId },
    });

    if (action === "accept") {
      await sendEmail({
        to: updated.email,
        subject: `You're accepted into ${family.name}`,
        html: memberAcceptedHtml({
          name: updated.name,
          familyName: family.name,
          link: appBaseUrl(),
        }),
      });
    } else {
      await sendEmail({
        to: updated.email,
        subject: `Update on ${family.name} membership`,
        html: `<div style="font-family:Georgia,serif"><p>Hi ${updated.name}, your request to join ${family.name} was not approved.</p></div>`,
      });
    }

    return NextResponse.json({ member: serializeMember(updated) });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
