import { z } from "zod";
import { noStoreJson, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  appBaseUrl,
  memberAcceptedHtml,
  sendEmail,
} from "@/lib/email";
import { serializeMember } from "@/lib/serializers";

const patchSchema = z
  .object({
    action: z.enum(["accept", "reject"]).optional(),
    name: z.string().trim().min(1).max(60).optional(),
    role: z.enum(["ADMIN", "MEMBER"]).optional(),
  })
  .refine(
    (body) =>
      body.action !== undefined ||
      body.name !== undefined ||
      body.role !== undefined,
    { message: "Provide action, name, and/or role" },
  );

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());

    const member = await prisma.member.findFirst({
      where: { id, familyId: admin.familyId },
    });
    if (!member) {
      return noStoreJson({ error: "Member not found" }, { status: 404 });
    }

    if (body.action === "reject" && member.role === "ADMIN") {
      return noStoreJson(
        { error: "Cannot reject an admin" },
        { status: 400 },
      );
    }

    if (body.role === "MEMBER" && member.role === "ADMIN") {
      const adminCount = await prisma.member.count({
        where: {
          familyId: admin.familyId,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      if (adminCount <= 1) {
        return noStoreJson(
          { error: "Keep at least one admin in the family" },
          { status: 400 },
        );
      }
    }

    const data: {
      status?: string;
      name?: string;
      role?: string;
    } = {};

    if (body.action === "accept") data.status = "ACTIVE";
    if (body.action === "reject") data.status = "REJECTED";
    if (body.name) data.name = body.name;
    if (body.role) data.role = body.role;

    const updated = await prisma.member.update({
      where: { id },
      data,
    });

    if (body.action === "accept" || body.action === "reject") {
      const family = await prisma.family.findUniqueOrThrow({
        where: { id: admin.familyId },
      });

      if (body.action === "accept") {
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
    }

    return noStoreJson({ member: serializeMember(updated) });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;

    const member = await prisma.member.findFirst({
      where: { id, familyId: admin.familyId },
    });
    if (!member) {
      return noStoreJson({ error: "Member not found" }, { status: 404 });
    }
    if (member.id === admin.id) {
      return noStoreJson(
        { error: "You cannot remove your own account" },
        { status: 400 },
      );
    }
    if (member.role === "ADMIN") {
      const adminCount = await prisma.member.count({
        where: {
          familyId: admin.familyId,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      if (adminCount <= 1) {
        return noStoreJson(
          { error: "Keep at least one admin in the family" },
          { status: 400 },
        );
      }
    }

    await prisma.member.delete({ where: { id } });
    return noStoreJson({ ok: true, removedId: id });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
