import { createHmac } from "node:crypto";

export type DeployPlatform = "netlify" | "vercel" | "local";

function platform(): DeployPlatform | null {
  const value = process.env.DEPLOY_PLATFORM?.trim().toLowerCase();
  return value === "netlify" || value === "vercel" || value === "local" ? value : null;
}

function singleIp(value: string | null): string | null {
  if (!value) return null;
  const candidate = value.split(",")[0]?.trim();
  if (!candidate || candidate.length > 64 || /[\r\n\s]/.test(candidate)) return null;
  return candidate;
}

export function extractTrustedClientIp(request: Request): string | null {
  const selected = platform();
  if (selected === "netlify") {
    return singleIp(request.headers.get("x-nf-client-connection-ip"));
  }
  if (selected === "vercel") {
    // Vercel sovrascrive questo header al bordo: non usiamo header inventati dal client.
    return singleIp(request.headers.get("x-forwarded-for"));
  }
  if (selected === "local" && process.env.NODE_ENV !== "production") {
    return singleIp(request.headers.get("x-forwarded-for")) ?? "127.0.0.1";
  }
  return null;
}

export function hashClientIp(ip: string): string {
  const secret = process.env.IP_HASH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("IP_HASH_SECRET non configurato");
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export function hashIpFromRequest(request: Request): string | null {
  const ip = extractTrustedClientIp(request);
  return ip ? hashClientIp(ip) : null;
}
