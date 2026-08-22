export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function errorResponse(message: string, status: number, code: string): Response {
  return jsonResponse({ message, code }, status);
}
