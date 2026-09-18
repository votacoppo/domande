import { privacyConfig, questionFormUrl } from "@/lib/config";
import { handlePublicQuestion } from "@/lib/http/public-question-handler";
import { insertQuestion } from "@/lib/questions-repository";
import { verifyQuestionSubmission } from "@/lib/security/public-form";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handlePublicQuestion(request, {
    privacyReady: () => privacyConfig().configured,
    sourceUrl: questionFormUrl,
    verifySubmission: verifyQuestionSubmission,
    insertQuestion,
  });
}
