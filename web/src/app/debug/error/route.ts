import { NextResponse } from "next/server";

/**
 * Dev-only trigger for GlitchTip verification. Hitting `/debug/error` throws
 * inside the Node runtime so `onRequestError` in `instrumentation.ts` picks
 * it up. Gated on APP_ENV so a stray hit in prod doesn't page anyone.
 */
export function GET() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "prod") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  throw new Error("wtg-web deliberate test error (server)");
}
