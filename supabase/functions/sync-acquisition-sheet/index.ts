import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { handleAcquisitionSheetSync, type AcquisitionSheetRow } from "./handler.ts";

const spreadsheetId = Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID") ?? "";
const clientEmail = Deno.env.get("GOOGLE_SHEETS_CLIENT_EMAIL") ?? "";
const privateKey = (Deno.env.get("GOOGLE_SHEETS_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
const sheetRange = "Acquisition!A:G";

function base64Url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function googleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const pem = privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(pem);
  const keyBytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`));
  const assertion = `${header}.${claim}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const body = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !body.access_token) throw new Error(body.error_description ?? "Google authorization failed");
  return body.access_token;
}

async function sheetsRequest(path: string, init?: RequestInit): Promise<Response> {
  const token = await googleAccessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Google Sheets request failed (${response.status})`);
  return response;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey" } });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const admin = createAdminClient();
  return handleAcquisitionSheetSync(request, {
    authenticate: async (incoming) => { await requireUserId(incoming, admin); },
    claimRows: async () => {
      const { data, error } = await admin.rpc("claim_onboarding_acquisition_sheet_rows", { p_limit: 100 });
      if (error) throw error;
      return (data ?? []) as AcquisitionSheetRow[];
    },
    existingResponseIds: async () => {
      const response = await sheetsRequest(`values/${encodeURIComponent("Acquisition!A:A")}`);
      const body = await response.json() as { values?: string[][] };
      return new Set((body.values ?? []).flatMap((values) => values[0] ? [values[0]] : []));
    },
    appendRows: async (values) => {
      await sheetsRequest(`values/${encodeURIComponent(sheetRange)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values }) });
    },
    markSynced: async (ids) => {
      const { error } = await admin.from("onboarding_acquisition_responses").update({ sheet_sync_status: "synced", sheet_synced_at: new Date().toISOString(), sheet_last_error: null }).in("id", ids);
      if (error) throw error;
    },
    releaseRows: async (ids, errorMessage) => {
      const { error } = await admin.from("onboarding_acquisition_responses").update({ sheet_sync_status: "pending", sheet_sync_started_at: null, sheet_last_error: errorMessage.slice(0, 240) }).in("id", ids);
      if (error) throw error;
    },
  }, { configured: Boolean(spreadsheetId && clientEmail && privateKey) });
});
