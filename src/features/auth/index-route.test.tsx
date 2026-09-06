/* eslint-disable import/first */
import { fireEvent, render } from "@testing-library/react-native";

const mockProfileRetry = jest.fn();
const mockAuth = { phase: "authenticated", user: { id: "user-1" } };
const mockOnboarding = {
  hydrated: true,
  status: "collecting",
  currentStep: "welcome",
  explicitLogoutAt: null,
};
const mockProfile: {
  status: "idle" | "loading" | "ready" | "error";
  profile: null | { onboardingCompleted: boolean; ageYears: number };
  error: string | null;
  retry: jest.Mock;
} = { status: "idle", profile: null, error: null, retry: mockProfileRetry };

jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native") as typeof import("react-native");
  return { Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text> };
});
jest.mock("@/features/auth/auth-provider", () => ({ useAuth: () => mockAuth }));
jest.mock("@/features/onboarding/onboarding-store", () => ({ useOnboarding: () => mockOnboarding }));
jest.mock("@/features/profile/profile-provider", () => ({ useProfile: () => mockProfile }));
jest.mock("@/features/access/access-provider", () => ({ useAccess: () => ({ access: { status: "expired" } }) }));

import IndexRoute from "@/app/index";

describe("authenticated launch handoff", () => {
  beforeEach(() => {
    mockProfileRetry.mockClear();
    mockProfile.status = "idle";
    mockProfile.profile = null;
    mockProfile.error = null;
  });

  it("keeps an authenticated account on account preparation before its profile effect starts", async () => {
    const screen = await render(<IndexRoute />);

    expect(screen.getByText("Preparing your Formie account…")).toBeTruthy();
    expect(screen.queryByText("redirect:/onboarding/welcome")).toBeNull();
  });

  it("shows a retryable profile error instead of misclassifying the account as new", async () => {
    mockProfile.status = "error";
    mockProfile.error = "Your profile could not be loaded. Try again.";
    const screen = await render(<IndexRoute />);

    expect(screen.getByRole("alert")).toHaveTextContent("Your profile could not be loaded. Try again.");
    fireEvent.press(screen.getByLabelText("Retry access check"));
    expect(mockProfileRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("redirect:/onboarding/welcome")).toBeNull();
  });
});
