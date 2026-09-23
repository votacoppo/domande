import { privacyConfig, questionFormUrl } from "@/lib/config";
import { handlePublicQuestion } from "@/lib/http/public-question-handler";
import { getQuestionSettings } from "@/lib/question-settings-repository";
import { insertQuestion } from "@/lib/questions-repository";
import { deviceCookieHeader, resolveDevice } from "@/lib/security/device";
import { verifyQuestionSubmission } from "@/lib/security/public-form";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handlePublicQuestion(request, {
    privacyReady: () => privacyConfig().configured,
    sourceUrl: questionFormUrl,
    loadSettings: getQuestionSettings,
    resolveDevice,
    deviceCookie: deviceCookieHeader,
    verifySubmission: verifyQuestionSubmission,
    insertQuestion,
  });
}
