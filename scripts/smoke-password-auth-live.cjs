const { createClient } = require("@supabase/supabase-js");

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) throw new Error("Supabase smoke-test configuration is missing");

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const auth = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stamp = Date.now();
  const email = `codex-auth-${stamp}@example.com`;
  const originalPassword = `Old-${stamp}-Aa9!`;
  const changedPassword = `New-${stamp}-Bb8!`;
  const recoveredPassword = `Recovered-${stamp}-Cc7!`;
  let userId = null;

  const resultCode = (result, success = "ok") => result.error?.code ?? success;

  try {
    let result = await admin.auth.admin.createUser({
      email,
      password: originalPassword,
      email_confirm: true,
    });
    if (result.error) throw result.error;
    userId = result.data.user.id;
    console.log("create=ok");

    result = await auth.auth.signInWithPassword({ email, password: originalPassword });
    console.log(`initial_signin=${resultCode(result)}`);

    result = await auth.auth.updateUser({ password: changedPassword, nonce: "000000" });
    console.log(`signed_in_update=${resultCode(result)}`);
    await auth.auth.signOut({ scope: "local" });

    result = await auth.auth.signInWithPassword({ email, password: originalPassword });
    console.log(`old_after_update=${resultCode(result, "unexpected_ok")}`);
    result = await auth.auth.signInWithPassword({ email, password: changedPassword });
    console.log(`new_after_update=${resultCode(result)}`);
    await auth.auth.signOut({ scope: "local" });

    const link = await admin.auth.admin.generateLink({ type: "recovery", email });
    console.log(`recovery_link=${resultCode(link)}`);
    if (link.error) throw link.error;
    result = await auth.auth.verifyOtp({
      token_hash: link.data.properties.hashed_token,
      type: "recovery",
    });
    console.log(`recovery_verify=${resultCode(result)}`);

    result = await auth.auth.updateUser({ password: recoveredPassword });
    console.log(`recovery_update=${resultCode(result)}`);
    await auth.auth.signOut({ scope: "local" });
    result = await auth.auth.signInWithPassword({ email, password: recoveredPassword });
    console.log(`new_after_recovery=${resultCode(result)}`);
  } finally {
    if (userId) {
      const deleted = await admin.auth.admin.deleteUser(userId);
      console.log(`cleanup=${resultCode(deleted)}`);
    }
  }
}

main().catch((error) => {
  console.error(`fatal=${error.code ?? error.message ?? "unknown"}`);
  process.exitCode = 1;
});
