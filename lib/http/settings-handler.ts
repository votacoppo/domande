import { parseSettingsInput, type QuestionSettings } from "../question-settings.ts";
import { mutationGuard, readJsonBody } from "../security/request.ts";
import { requireAdminSession } from "./admin-login-handler.ts";

export type SettingsDependencies = {
  authenticated: () => Promise<boolean>;
  load: () => Promise<QuestionSettings>;
  save: (settings: QuestionSettings) => Promise<QuestionSettings>;
};

export async function handleGetSettings(dependencies: SettingsDependencies): Promise<Response> {
  const unauthorized = requireAdminSession(await dependencies.authenticated());
  if (unauthorized) return unauthorized;
  try {
    return Response.json({ settings: await dependencies.load() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Impostazioni non disponibili." }, { status: 503 });
  }
}

export async function handleSaveSettings(
  request: Request,
  dependencies: SettingsDependencies,
): Promise<Response> {
  const unauthorized = requireAdminSession(await dependencies.authenticated());
  if (unauthorized) return unauthorized;
  const blocked = mutationGuard(request);
  if (blocked) return blocked;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = parseSettingsInput(body.value);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    return Response.json({ ok: true, settings: await dependencies.save(parsed.value) });
  } catch {
    return Response.json({ error: "Salvataggio non riuscito. Riprova." }, { status: 503 });
  }
}
