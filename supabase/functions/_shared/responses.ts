import { corsHeaders } from "./cors.ts";

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status: number, code: string): Response {
  return jsonResponse({ message, code }, status);
}
