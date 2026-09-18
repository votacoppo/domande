import { hashIpFromRequest } from "./ip";
import { checkHourlyRateLimit } from "./rate-limit";
import { verifyTurnstile } from "./turnstile";
import {
  verifyPublicSubmission,
  type PublicGuardResult,
} from "./public-form-policy";

export type { PublicGuardResult } from "./public-form-policy";

export async function verifyQuestionSubmission(
  request: Request,
  record: Record<string, unknown>,
): Promise<PublicGuardResult> {
  return verifyPublicSubmission(request, record, {
    hashIp: hashIpFromRequest,
    verifyCaptcha: verifyTurnstile,
    checkRateLimit: checkHourlyRateLimit,
  });
}
