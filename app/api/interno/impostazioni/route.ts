import { hasAdminSession } from "@/lib/auth/session";
import { handleGetSettings, handleSaveSettings } from "@/lib/http/settings-handler";
import { getQuestionSettings, updateQuestionSettings } from "@/lib/question-settings-repository";

export const dynamic = "force-dynamic";

const dependencies = {
  authenticated: hasAdminSession,
  load: getQuestionSettings,
  save: updateQuestionSettings,
};

export async function GET() {
  return handleGetSettings(dependencies);
}

export async function PUT(request: Request) {
  return handleSaveSettings(request, dependencies);
}
