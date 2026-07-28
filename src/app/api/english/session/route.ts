import { NextResponse } from "next/server";

/**
 * Placeholder for future OpenAI Realtime (or similar) session minting.
 * Keep API keys server-side only — never expose them to the browser.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "English voice AI is not configured yet. Add OPENAI_API_KEY and implement Realtime session here.",
    },
    { status: 501 }
  );
}
