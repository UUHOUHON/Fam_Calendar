import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, requireAdmin, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeFamilyBundle } from "@/lib/serializers";

async function getFamilyBundle() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const family = await prisma.family.findUnique({
    where: { id: session.familyId },
  });
  if (!family) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }

  const me = await prisma.member.findUnique({ where: { id: session.id } });
  const members = await prisma.member.findMany({
    where: { familyId: family.id },
    orderBy: { createdAt: "asc" },
  });
  const activities = await prisma.activity.findMany({
    where: { member: { familyId: family.id } },
    include: {
      member: true,
      invites: { include: { member: true } },
    },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json(
    serializeFamilyBundle(family, members, activities, me),
  );
}

export async function GET() {
  return getFamilyBundle();
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const name = z.string().trim().min(1).max(80).parse((await request.json()).name);
    const updated = await prisma.family.update({
      where: { id: admin.familyId },
      data: { name },
    });
    return NextResponse.json({ id: updated.id, name: updated.name });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}

// Keep POST unused for member create — signup/invite flow replaces it
export async function POST() {
  try {
    await requireSession();
    return NextResponse.json(
      { error: "Use /signup or admin invites to add members" },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
