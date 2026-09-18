import "server-only";
import { getAdminClient } from "../supabase-admin";
import {
  runRateLimitCheck,
  type RateLimitInput,
  type RateLimitResult,
} from "./rate-limit-policy";

export async function checkHourlyRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  return runRateLimitCheck(input, async (rpcInput, signal) => {
    const supabase = getAdminClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_scope: rpcInput.key,
      p_identifier: rpcInput.ipHash,
      p_limit: rpcInput.max,
      p_window_seconds: 3600,
    }).abortSignal(signal);
    return { data, error };
  });
}
