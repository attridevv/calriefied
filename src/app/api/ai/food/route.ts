import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    if (!query) return NextResponse.json({ error: "Food description required" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI key not configured" }, { status: 400 });
    }

    const prompt = `Estimate nutrition for: "${query}"

Return ONLY a JSON object with these keys (no markdown, no explanation):
{
  "name": "string - best food name",
  "serving": "string - typical serving description (e.g. '1 cup', '100g')",
  "servingGrams": number - estimated grams for 1 serving,
  "calories": number,
  "protein": number - grams,
  "carbs": number - grams,
  "fat": number - grams,
  "fiber": number - grams
}

If the food is unclear, make your best reasonable guess. Be conservative. Do NOT include any text outside the JSON.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a nutrition database. Return only valid JSON with nutrition estimates. Never include markdown or extra text." },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!response.ok) throw new Error("OpenAI request failed");

    const completion = await response.json();
    const raw = completion.choices?.[0]?.message?.content || "";

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      result = JSON.parse(cleaned);
    }

    return NextResponse.json({
      name: result.name || query,
      serving: result.serving || "1 serving",
      servingGrams: result.servingGrams || null,
      calories: result.calories || 0,
      protein: result.protein || 0,
      carbs: result.carbs || 0,
      fat: result.fat || 0,
      fiber: result.fiber || 0,
    });
  } catch (error) {
    console.error("AI food lookup error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to estimate. Try a more specific description." }, { status: 500 });
  }
}
