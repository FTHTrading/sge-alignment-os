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
    const partner = await prisma.partner.findUnique({
      where: { id: params.id },
      include: {
        organization: true,
        projects: {
          include: {
            _count: { select: { deployments: true, milestones: true } },
          },
        },
        _count: { select: { projects: true } },
      },
    });

    if (!partner) return notFound("Partner not found");
    return ok(partner);
  } catch (error) {
    console.error("GET /api/partners/[id] error:", error);
    return serverError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { tier, status, region, contactName, contactEmail, notes, commitmentSummary } = body;

    const existing = await prisma.partner.findUnique({ where: { id: params.id } });
    if (!existing) return notFound("Partner not found");

    const partner = await prisma.partner.update({
      where: { id: params.id },
      data: {
        ...(tier !== undefined && { tier }),
        ...(status !== undefined && { status }),
        ...(region !== undefined && { region }),
        ...(contactName !== undefined && { contactName }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(notes !== undefined && { notes }),
        ...(commitmentSummary !== undefined && { commitmentSummary }),
      },
      include: { organization: true },
    });

    await prisma.auditEvent.create({
      data: {
        eventType: "partner",
        entityType: "partner",
        entityId: partner.id,
        summary: `Partner ${partner.id} updated`,
        detail: body,
        hash: "",
        partnerId: partner.id,
      },
    });

    return ok(partner);
  } catch (error) {
    console.error("PATCH /api/partners/[id] error:", error);
    return serverError();
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.partner.findUnique({ where: { id: params.id } });
    if (!existing) return notFound("Partner not found");

    await prisma.auditEvent.create({
      data: {
        eventType: "partner",
        entityType: "partner",
        entityId: existing.id,
        summary: `Partner ${existing.id} deleted`,
        detail: { partnerId: existing.id },
        hash: "",
      },
    });

    await prisma.partner.delete({ where: { id: params.id } });

    return noContent();
  } catch (error) {
    console.error("DELETE /api/partners/[id] error:", error);
    return serverError();
  }
}
