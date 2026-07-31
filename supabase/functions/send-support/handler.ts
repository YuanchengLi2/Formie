type SupportCategory = "account" | "billing" | "bug" | "feature" | "other";

type EmailInput = {
  idempotencyKey: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
};

type Reservation =
  | { allowed: true }
  | { allowed: false; limit: "ip" | "email" };

export type SendSupportDependencies = {
  authenticateInternalRequest: (request: Request) => boolean;
  createRequestId: () => string;
  hashIdentifier: (kind: "ip" | "email", value: string) => Promise<string>;
  reserveRequest: (input: {
    requestId: string;
    ipHash: string;
    emailHash: string;
    category: SupportCategory;
  }) => Promise<Reservation>;
  updateRequestStatus: (input: {
    requestId: string;
    status: "sent" | "failed";
    providerMessageId?: string;
  }) => Promise<void>;
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

function categoryTitle(category: SupportCategory): string {
  if (category === "account") return "Account";
  if (category === "billing") return "Billing";
  if (category === "bug") return "Bug";
  if (category === "feature") return "Feature Request";
  return "Other";
}

function parseBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_BODY");
  const body = value as Record<string, unknown>;
  const allowedKeys = ["name", "email", "category", "message", "website"];
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) throw new Error("INVALID_BODY");

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const category = body.category;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const website = typeof body.website === "string" ? body.website.trim() : "";
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validCategory = ["account", "billing", "bug", "feature", "other"].includes(String(category));

  if (
    name.length > 100 ||
    !validEmail ||
    email.length > 254 ||
    !validCategory ||
    message.length < 20 ||
    message.length > 2000 ||
    website.length > 0
  ) {
    throw new Error("INVALID_BODY");
  }

  return { name, email, category: category as SupportCategory, message };
}

export async function createSendSupportHandler(
  request: Request,
  dependencies: SendSupportDependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  }
  if (!dependencies.authenticateInternalRequest(request)) {
    return json({ message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  let body;
  try {
    body = parseBody(await request.json());
  } catch {
    return json({
      message: "Enter a valid email, choose a category, and write 20–2,000 characters.",
      code: "INVALID_SUPPORT_REQUEST",
    }, 400);
  }

  const clientIp = request.headers.get("X-Formie-Client-IP")?.trim();
  if (!clientIp || clientIp.length > 64) {
    return json({ message: "Support is temporarily unavailable.", code: "INVALID_CLIENT_CONTEXT" }, 400);
  }

  const requestId = dependencies.createRequestId();
  const [ipHash, emailHash] = await Promise.all([
    dependencies.hashIdentifier("ip", clientIp),
    dependencies.hashIdentifier("email", body.email),
  ]);
  const reservation = await dependencies.reserveRequest({
    requestId,
    ipHash,
    emailHash,
    category: body.category,
  });
  if (!reservation.allowed) {
    return json({
      message: "Too many support requests. Please try again later.",
      code: "RATE_LIMITED",
    }, 429);
  }

  const displayName = body.name || "Not provided";
  const title = categoryTitle(body.category);
  const escapedMessage = escapeHtml(body.message).replaceAll("\n", "<br>");
  try {
    const delivery = await dependencies.sendEmail({
      idempotencyKey: requestId,
      replyTo: body.email,
      subject: `[Formie Support: ${title}] ${body.email}`,
      text: `${body.message}\n\nName: ${displayName}\nEmail: ${body.email}\nCategory: ${body.category}\nRequest ID: ${requestId}`,
      html: `<h2>Formie Support: ${title}</h2><p>${escapedMessage}</p><hr><p><strong>Name:</strong> ${escapeHtml(displayName)}<br><strong>Email:</strong> ${escapeHtml(body.email)}<br><strong>Category:</strong> ${escapeHtml(body.category)}<br><strong>Request ID:</strong> ${escapeHtml(requestId)}</p>`,
    });
    await dependencies.updateRequestStatus({
      requestId,
      status: "sent",
      providerMessageId: delivery.id,
    });
  } catch {
    await dependencies.updateRequestStatus({ requestId, status: "failed" }).catch(() => undefined);
    return json({
      message: "Your request could not be delivered. Please try again.",
      code: "EMAIL_DELIVERY_FAILED",
      requestId,
    }, 502);
  }

  return json({ submitted: true, requestId }, 200);
}
