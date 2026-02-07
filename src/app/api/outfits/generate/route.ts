import { NextResponse } from "next/server";

// Gate 10.x discipline:
// Outfit generation is NOT in scope for this gate.
// This endpoint is intentionally a placeholder so builds stay green.
// Gate 11 will implement real outfit generation.

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: "Outfit generation is not enabled yet (Gate 11).",
    },
    { status: 501 }
  );
}
