import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeMember } from "@/lib/serializers";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  timezone: z.string().trim().min(1).optional(),
  color: z.string().trim().min(1).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = updateSchema.parse(await request.json());

    if (session.id !== id && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const target = await prisma.member.findFirst({
      where: { id, familyId: session.familyId },
    });
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const member = await prisma.member.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(serializeMember(member));
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    await prisma.member.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
