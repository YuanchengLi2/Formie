type FeedbackCategory = "bug" | "feature_request" | "general" | "priority_support";
type FeedbackUser = { id: string; email: string };

type EmailInput = {
  idempotencyKey: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
};

export type SendFeedbackDependencies = {
  authenticate: (request: Request) => Promise<FeedbackUser>;
  hasPriorityAccess?: (userId: string) => Promise<boolean>;
  sendEmail: (input: EmailInput) => Promise<{ id: string }>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function title(category: FeedbackCategory): string {
  if (category === "priority_support") return "Priority Support";
  if (category === "feature_request") return "Feature Request";
  if (category === "bug") return "Bug";
  return "General";
}

function parseBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_BODY");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["clientRequestId", "category", "message", "diagnostics"].includes(key))) throw new Error("INVALID_BODY");
  const clientRequestId = typeof body.clientRequestId === "string" ? body.clientRequestId.trim() : "";
  const category = body.category;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (clientRequestId.length < 8 || clientRequestId.length > 128) throw new Error("INVALID_BODY");
  if (category !== "bug" && category !== "feature_request" && category !== "general" && category !== "priority_support") throw new Error("INVALID_BODY");
  if (message.length < 20 || message.length > 2000) throw new Error("INVALID_BODY");
  if (!body.diagnostics || typeof body.diagnostics !== "object" || Array.isArray(body.diagnostics)) throw new Error("INVALID_BODY");
  const diagnostics = body.diagnostics as Record<string, unknown>;
  const allowedDiagnosticKeys = ["appVersion", "build", "platform", "osVersion"];
  if (Object.keys(diagnostics).some((key) => !allowedDiagnosticKeys.includes(key))) throw new Error("INVALID_BODY");
  if (allowedDiagnosticKeys.some((key) => typeof diagnostics[key] !== "string" || !(diagnostics[key] as string).trim() || (diagnostics[key] as string).length > 100)) throw new Error("INVALID_BODY");
  if (diagnostics.platform !== "ios" && diagnostics.platform !== "android" && diagnostics.platform !== "web") throw new Error("INVALID_BODY");
  return {
    clientRequestId,
    category,
    message,
    diagnostics: {
      appVersion: (diagnostics.appVersion as string).trim(),
      build: (diagnostics.build as string).trim(),
      platform: diagnostics.platform,
      osVersion: (diagnostics.osVersion as string).trim(),
    },
  };
}

export async function createSendFeedbackHandler(request: Request, dependencies: SendFeedbackDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  let body;
  try {
    body = parseBody(await request.json());
  } catch {
    return json({ message: "Enter 20–2,000 characters and choose a valid category", code: "INVALID_BODY" }, 400);
  }

  let user: FeedbackUser;
  try {
    user = await dependencies.authenticate(request);
    if (!user.email) throw new Error("UNAUTHORIZED");
  } catch {
    return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
  }
  if (body.category === "priority_support" && dependencies.hasPriorityAccess && !(await dependencies.hasPriorityAccess(user.id))) {
    return json({ message: "Priority support is available with an active Formie subscription.", code: "PRIORITY_SUPPORT_REQUIRED" }, 402);
  }

  const diagnosticsText = [
    `App version: ${body.diagnostics.appVersion}`,
    `Build: ${body.diagnostics.build}`,
    `Platform: ${body.diagnostics.platform}`,
    `OS version: ${body.diagnostics.osVersion}`,
  ].join("\n");
  const escapedMessage = escapeHtml(body.message).replaceAll("\n", "<br>");
  const escapedDiagnostics = escapeHtml(diagnosticsText).replaceAll("\n", "<br>");
  try {
    await dependencies.sendEmail({
      idempotencyKey: body.clientRequestId,
      replyTo: user.email,
      subject: `[Formie ${title(body.category)}] ${user.email}`,
      text: `${body.message}\n\nCategory: ${body.category}\nUser: ${user.email}\nRequest: ${body.clientRequestId}\n${diagnosticsText}`,
      html: `<h2>Formie ${title(body.category)}</h2><p>${escapedMessage}</p><hr><p><strong>User:</strong> ${escapeHtml(user.email)}<br><strong>Request:</strong> ${escapeHtml(body.clientRequestId)}<br>${escapedDiagnostics}</p>`,
    });
  } catch {
    return json({ message: "Feedback could not be sent. Try again.", code: "EMAIL_DELIVERY_FAILED" }, 502);
  }
  return json({ submitted: true, requestId: body.clientRequestId }, 200);
}
