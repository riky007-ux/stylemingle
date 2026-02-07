import { NextResponse } from "next/server";

// Gate 10.x discipline:
// Outfit regeneration is NOT in scope for this gate.
// This endpoint is intentionally a placeholder so builds stay green.
// Gate 11 will implement real regeneration.

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: "Outfit regeneration is not enabled yet (Gate 11).",
    },
    { status: 501 }
  );
}
