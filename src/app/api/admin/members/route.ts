import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeMember } from "@/lib/serializers";

export async function GET() {
  try {
    const admin = await requireAdmin();
    const members = await prisma.member.findMany({
      where: { familyId: admin.familyId },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      members: members.map(serializeMember),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
