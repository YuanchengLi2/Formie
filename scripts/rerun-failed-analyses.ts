import { createClient } from "@supabase/supabase-js";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const sessionIds = process.argv.slice(2);
if (sessionIds.length === 0) {
  throw new Error("Usage: tsx scripts/rerun-failed-analyses.ts <session-id> [session-id]");
}

const supabaseUrl = required("EXPO_PUBLIC_SUPABASE_URL");
const anonKey = required("EXPO_PUBLIC_SUPABASE_ANON_KEY");
const admin = createClient(supabaseUrl, required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function postFunction(name: string, accessToken: string, body: object) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`${name} failed (${response.status}): ${String(payload.code ?? payload.error ?? "UNKNOWN")}`);
  }
  return payload;
}

async function accessTokenForUser(userId: string) {
  const userResult = await admin.auth.admin.getUserById(userId);
  const email = userResult.data.user?.email;
  if (userResult.error || !email) throw userResult.error ?? new Error("Analysis owner has no email");

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data.properties?.hashed_token;
  if (link.error || !tokenHash) throw link.error ?? new Error("Could not create a short-lived retry session");

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  const accessToken = verified.data.session?.access_token;
  if (verified.error || !accessToken) throw verified.error ?? new Error("Could not verify the retry session");
  return accessToken;
}

async function rerun(sessionId: string) {
  const session = await admin
    .from("analysis_sessions")
    .select("id,user_id,status,video_path,gemini_file_name")
    .eq("id", sessionId)
    .single();
  if (session.error || (!session.data.video_path && !session.data.gemini_file_name)) {
    throw session.error ?? new Error(`Session ${sessionId} has no retained analysis input`);
  }

  const accessToken = await accessTokenForUser(session.data.user_id);
  try {
    await postFunction("reanalyze-video", accessToken, { sessionId });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("ALREADY_PROCESSING")) throw error;
  }

  let response: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    response = await postFunction("analyze-video", accessToken, { sessionId });
    if (["complete", "partial", "unable", "failed"].includes(String(response.status))) break;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  const persisted = await admin
    .from("analysis_sessions")
    .select("id,status,stage,failure_code,pipeline_version")
    .eq("id", sessionId)
    .single();
  if (persisted.error) throw persisted.error;
  if (!["complete", "partial", "unable"].includes(persisted.data.status)) {
    throw new Error(`Session ${sessionId} did not complete: ${JSON.stringify(persisted.data)}`);
  }
  return persisted.data;
}

async function main() {
  const results = [];
  for (const sessionId of sessionIds) results.push(await rerun(sessionId));
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
