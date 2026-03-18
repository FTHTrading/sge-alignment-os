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
    const proposal = await prisma.governanceProposal.findUnique({
      where: { id: params.id },
      include: {
        resolutions: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!proposal) return notFound("Proposal not found");
    return ok(proposal);
  } catch (error) {
    console.error("GET /api/governance/[id] error:", error);
    return serverError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const existing = await prisma.governanceProposal.findUnique({ where: { id: params.id } });
    if (!existing) return notFound("Proposal not found");

    const { status, title, summary, category } = body;

    const proposal = await prisma.governanceProposal.update({
      where: { id: params.id },
      data: {
        ...(status !== undefined && { status }),
        ...(title !== undefined && { title }),
        ...(summary !== undefined && { summary }),
        ...(category !== undefined && { category }),
        ...(status === "passed" || status === "rejected" ? { closedAt: new Date() } : {}),
        ...(status === "implemented" ? { implementedAt: new Date() } : {}),
      },
    });

    if (status === "passed") {
      await prisma.governanceResolution.create({
        data: {
          title: `Resolution for: ${existing.title}`,
          proposalId: proposal.id,
          status: "published",
          publishedAt: new Date(),
        },
      });
    }

    await prisma.auditEvent.create({
      data: {
        eventType: "governance",
        entityType: "proposal",
        entityId: proposal.id,
        summary: `Proposal "${proposal.title}" ${status || "updated"}`,
        detail: body,
        hash: "",
      },
    });

    return ok(proposal);
  } catch (error) {
    console.error("PATCH /api/governance/[id] error:", error);
    return serverError();
  }
}
