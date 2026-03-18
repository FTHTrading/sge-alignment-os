import { NextRequest } from "next/server";
import { prisma } from "@sge/db";
import { ok, notFound, noContent, serverError } from "../../_helpers";

export function generateStaticParams() {
  return [];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        partner: { select: { id: true, tier: true, organization: { select: { name: true } } } },
        deployments: true,
        milestones: { orderBy: { dueDate: "asc" } },
        _count: { select: { deployments: true, milestones: true } },
      },
    });

    if (!project) return notFound("Project not found");
    return ok(project);
  } catch (error) {
    console.error("GET /api/projects/[id] error:", error);
    return serverError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const existing = await prisma.project.findUnique({ where: { id: params.id } });
    if (!existing) return notFound("Project not found");

    const { name, status, region, country, energyGoalMW, description, impactSummary } = body;
    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(status !== undefined && { status }),
        ...(region !== undefined && { region }),
        ...(country !== undefined && { country }),
        ...(energyGoalMW !== undefined && { energyGoalMW }),
        ...(description !== undefined && { description }),
        ...(impactSummary !== undefined && { impactSummary }),
      },
    });

    await prisma.auditEvent.create({
      data: {
        eventType: "project",
        entityType: "project",
        entityId: project.id,
        summary: `Project "${project.name}" updated`,
        detail: body,
        hash: "",
        projectId: project.id,
      },
    });

    return ok(project);
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error);
    return serverError();
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.project.findUnique({ where: { id: params.id } });
    if (!existing) return notFound("Project not found");

    await prisma.auditEvent.create({
      data: {
        eventType: "project",
        entityType: "project",
        entityId: existing.id,
        summary: `Project "${existing.name}" deleted`,
        detail: { projectId: existing.id },
        hash: "",
      },
    });

    await prisma.project.delete({ where: { id: params.id } });

    return noContent();
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error);
    return serverError();
  }
}
