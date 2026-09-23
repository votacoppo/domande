import { hashIpFromRequest } from "./ip";
import { checkRateLimit } from "./rate-limit";
import { verifyTurnstile } from "./turnstile";
import {
  verifyPublicSubmission,
  type PublicGuardResult,
} from "./public-form-policy";
import type { QuestionSettings } from "../question-settings";

export type { PublicGuardResult } from "./public-form-policy";

export async function verifyQuestionSubmission(
  request: Request,
  record: Record<string, unknown>,
  context: { deviceHash: string; settings: QuestionSettings },
): Promise<PublicGuardResult> {
  return verifyPublicSubmission(request, record, context, {
    hashIp: hashIpFromRequest,
    verifyCaptcha: verifyTurnstile,
    checkRateLimit,
  });
}
