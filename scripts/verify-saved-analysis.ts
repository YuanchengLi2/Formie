import { createClient } from "@supabase/supabase-js";

import { analysisResultSchema } from "../src/features/analysis/result-schema";
import { resultPayload } from "../supabase/functions/_shared/result-payload";

const sessionId = process.argv[2];
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!sessionId || !url || !serviceKey) {
  throw new Error("Usage: verify-saved-analysis <session-id> with Supabase URL and service-role environment variables");
}

async function main() {
  const admin = createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [{ data: session, error: sessionError }, { data: result, error: resultError }] = await Promise.all([
    admin.from("analysis_sessions").select("*").eq("id", sessionId).single(),
    admin.from("analysis_results").select("*").eq("session_id", sessionId).single(),
  ]);
  if (sessionError) throw sessionError;
  if (resultError) throw resultError;
  const payload = resultPayload(session, result);
  const parsed = analysisResultSchema.safeParse(payload);
  if (!parsed.success) {
    console.error(parsed.error.issues);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      sessionId,
      status: session.status,
      pipelineVersion: result.pipeline_version,
      resultOpens: true,
      normalizedLoads: parsed.data.equipmentObservations?.map((item) => item.load) ?? [],
    }));
  }
}

void main();
