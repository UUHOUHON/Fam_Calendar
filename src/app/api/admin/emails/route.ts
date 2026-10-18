import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    const emails = await prisma.emailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    return NextResponse.json({
      emails: emails.map((e) => ({
        id: e.id,
        to: e.to,
        subject: e.subject,
        previewUrl: e.previewUrl,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
