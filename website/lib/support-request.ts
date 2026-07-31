export const supportCategories = ["account", "billing", "bug", "feature", "other"] as const;

export type SupportCategory = typeof supportCategories[number];

export type SupportRequest = {
  name?: string;
  email: string;
  category: SupportCategory;
  message: string;
  website: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseSupportRequest(value: unknown): SupportRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_SUPPORT_REQUEST");
  }

  const body = value as Record<string, unknown>;
  const allowedKeys = ["name", "email", "category", "message", "website"];
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
    throw new Error("INVALID_SUPPORT_REQUEST");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const category = body.category;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const website = typeof body.website === "string" ? body.website.trim() : "";

  if (
    name.length > 100 ||
    !emailPattern.test(email) ||
    email.length > 254 ||
    !supportCategories.includes(category as SupportCategory) ||
    message.length < 20 ||
    message.length > 2000 ||
    website.length > 0
  ) {
    throw new Error("INVALID_SUPPORT_REQUEST");
  }

  return {
    ...(name ? { name } : {}),
    email,
    category: category as SupportCategory,
    message,
    website,
  };
}
