import { NextResponse } from "next/server";
import { isUnauthorizedError, requireCurrentDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withDbRetry } from "@/lib/retry";

function todayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function GET(request: Request) {
  try {
    const { id: userId } = await requireCurrentDbUser();
    const { searchParams } = new URL(request.url);
    const isToday = searchParams.get("today") === "1";
    const days = parseInt(searchParams.get("days") || "1");

    const isRepeat = searchParams.get("repeat") === "1";
    if (isRepeat) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yStart = new Date(yesterday); yStart.setHours(0, 0, 0, 0);
      const yEnd = new Date(yesterday); yEnd.setHours(23, 59, 59, 999);

      const yesterdayEntries = await prisma.foodEntry.findMany({
        where: { userId, date: { gte: yStart, lte: yEnd } },
        orderBy: { createdAt: "asc" },
      });

      if (yesterdayEntries.length === 0) {
        return NextResponse.json({ entries: [], repeated: 0 });
      }

      const today = new Date();
      const entries = await Promise.all(
        yesterdayEntries.map(e =>
          prisma.foodEntry.create({
            data: {
              userId: e.userId,
              date: today,
              mealType: e.mealType,
              name: e.name,
              serving: e.serving,
              calories: e.calories,
              protein: e.protein,
              carbs: e.carbs,
              fat: e.fat,
              fiber: e.fiber,
              notes: e.notes,
            },
          })
        )
      );

      return NextResponse.json({ entries, repeated: entries.length });
    }

    if (isToday) {
      const { start, end } = todayRange();
      const [entries, profile, waterRecs] = await withDbRetry(() => Promise.all([
        prisma.foodEntry.findMany({ where: { userId, date: { gte: start, lte: end } }, orderBy: { createdAt: "desc" } }),
        prisma.profile.findUnique({ where: { userId } }),
        prisma.waterIntake.findMany({ where: { userId, date: { gte: start, lte: end } } }),
      ]));

      const summary = entries.reduce((s, e) => ({
        calories: s.calories + (e.calories || 0),
        protein: s.protein + (e.protein || 0),
        carbs: s.carbs + (e.carbs || 0),
        fat: s.fat + (e.fat || 0),
        fiber: s.fiber + (e.fiber || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

      const water = { totalMl: waterRecs.reduce((s, w) => s + w.amountMl, 0) };

      return NextResponse.json({ summary, entries, profile, water });
    }

    if (days > 1) {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days); cutoff.setHours(0, 0, 0, 0);
      const entries = await prisma.foodEntry.findMany({ where: { userId, date: { gte: cutoff } }, orderBy: { date: "asc" } });

      const grouped: Record<string, any> = {};
      entries.forEach(e => {
        const d = new Date(e.date).toISOString().split("T")[0];
        if (!grouped[d]) grouped[d] = { date: d, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
        grouped[d].calories += e.calories || 0;
        grouped[d].protein += e.protein || 0;
        grouped[d].carbs += e.carbs || 0;
        grouped[d].fat += e.fat || 0;
        grouped[d].fiber += e.fiber || 0;
      });

      return NextResponse.json({ weekly: Object.values(grouped) });
    }

    const { start, end } = todayRange();
    const entries = await prisma.foodEntry.findMany({ where: { userId, date: { gte: start, lte: end } }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ entries });
  } catch (error) {
    if (isUnauthorizedError(error)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Food GET error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to load food data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { id: userId } = await requireCurrentDbUser();
    const body = await request.json();

    const entry = await prisma.foodEntry.create({
      data: {
        userId,
        date: new Date(),
        mealType: body.mealType || "snack",
        name: body.name || "Unknown",
        serving: body.serving || 1,
        calories: body.calories || 0,
        protein: body.protein || 0,
        carbs: body.carbs || 0,
        fat: body.fat || 0,
        fiber: body.fiber || 0,
        notes: body.notes || null,
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    if (isUnauthorizedError(error)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Food POST error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to log food" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id: userId } = await requireCurrentDbUser();
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get("id");
    if (!entryId) return NextResponse.json({ error: "ID required" }, { status: 400 });
    await prisma.foodEntry.deleteMany({ where: { id: entryId, userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isUnauthorizedError(error)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
