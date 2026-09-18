import { mutationGuard, readJsonBody } from "../security/request.ts";

export async function validateLogoutRequest(request: Request): Promise<Response | null> {
  const blocked = mutationGuard(request);
  if (blocked) return blocked;
  const body = await readJsonBody(request);
  return body.ok ? null : body.response;
}
