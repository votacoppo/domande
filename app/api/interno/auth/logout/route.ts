import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions } from "@/lib/auth/session";
import { validateLogoutRequest } from "@/lib/http/logout-handler";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = await validateLogoutRequest(request);
  if (blocked) return blocked;
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", adminCookieOptions(0));
  return response;
}
