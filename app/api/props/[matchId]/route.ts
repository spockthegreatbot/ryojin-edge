import { NextResponse } from "next/server";
import { MOCK_MATCHES } from "@/lib/mock-data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const match = MOCK_MATCHES.find((m) => m.id === matchId);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }
  return NextResponse.json(match);
}
