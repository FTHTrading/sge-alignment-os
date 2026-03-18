import { NextRequest } from "next/server";
import { prisma } from "@sge/db";
import { ok, notFound, serverError } from "../../_helpers";

export function generateStaticParams() {
  return [];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const milestone = await prisma.milestone.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { name: true, slug: true } },
      },
    });

    if (!milestone) return notFound("Milestone not found");
    return ok(milestone);
  } catch (error) {
    console.error("GET /api/milestones/[id] error:", error);
    return serverError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const existing = await prisma.milestone.findUnique({ where: { id: params.id } });
    if (!existing) return notFound("Milestone not found");

    const { name, description, status, dueDate, weight, evidenceNotes, verifiedById } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (weight !== undefined) updateData.weight = weight;
    if (evidenceNotes !== undefined) updateData.evidenceNotes = evidenceNotes;
    if (verifiedById !== undefined) updateData.verifiedById = verifiedById;

    if (status === "verified" && existing.status !== "verified") {
      updateData.verifiedAt = new Date();
    }

    const milestone = await prisma.milestone.update({
      where: { id: params.id },
      data: updateData,
    });

    const eventType = status === "verified" ? "milestone.verified" : "milestone.updated";
    await prisma.auditEvent.create({
      data: {
        eventType,
        entityType: "milestone",
        entityId: milestone.id,
        summary: `Milestone "${milestone.name}" ${status === "verified" ? "verified" : "updated"}`,
        detail: body,
        hash: "",
        milestoneId: milestone.id,
      },
    });

    return ok(milestone);
  } catch (error) {
    console.error("PATCH /api/milestones/[id] error:", error);
    return serverError();
  }
}
