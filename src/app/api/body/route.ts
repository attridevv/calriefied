import { NextResponse } from "next/server";
import { isUnauthorizedError, requireCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withDbRetry } from "@/lib/retry";

export async function GET() {
  try {
    const { id: userId } = await requireCurrentDbUser();
    const stats = await withDbRetry(() => prisma.bodyStat.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 60 }));
    return NextResponse.json(stats);
  } catch (error) {
    if (isUnauthorizedError(error)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Failed to load body stats" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { id: userId } = await requireCurrentDbUser();
    const body = await request.json();

    const stat = await prisma.bodyStat.create({
      data: {
        userId,
        date: new Date(),
        weight: body.weight || null,
        bodyFat: body.bodyFat || null,
        waistCm: body.waistCm || null,
        notes: body.notes || null,
      },
    });

    return NextResponse.json(stat);
  } catch (error) {
    if (isUnauthorizedError(error)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Failed to save body stats" }, { status: 500 });
  }
}
