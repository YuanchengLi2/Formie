import { AdminLoginForm } from "@/components/admin/admin-login-form";

const errors: Record<string, string> = {
  invalid: "The email or password is incorrect.",
  forbidden: "This account is not approved for founder access.",
  config: "Founder login is temporarily unavailable.",
};

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <AdminLoginForm error={params.error ? errors[params.error] ?? errors.invalid : undefined} />;
}
