import { NextResponse } from "next/server";
import { verifyAdminCredentials } from "@/lib/auth/credentials";
import { ADMIN_COOKIE, adminCookieOptions, createSessionToken } from "@/lib/auth/session";
import { evaluateAdminLogin } from "@/lib/http/admin-login-handler";
import { hashIpFromRequest } from "@/lib/security/ip";
import { checkHourlyRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const result = await evaluateAdminLogin(request, {
    hashIp: hashIpFromRequest,
    checkRateLimit: checkHourlyRateLimit,
    verifyCredentials: verifyAdminCredentials,
  });
  if (!result.ok) return result.response;

  let token: string;
  try {
    token = createSessionToken(result.email);
  } catch {
    return NextResponse.json({ error: "Servizio non configurato." }, { status: 503 });
  }
  const response = NextResponse.json({ ok: true, redirect: "/interno/domande" });
  response.cookies.set(ADMIN_COOKIE, token, adminCookieOptions(7 * 24 * 60 * 60));
  return response;
}
