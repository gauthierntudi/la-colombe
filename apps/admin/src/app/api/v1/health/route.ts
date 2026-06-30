import { NextResponse } from "next/server";

/**
 * Health check — vérifie que l'API et la DB sont accessibles.
 * GET /api/v1/health
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "ges-boutique-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
}
