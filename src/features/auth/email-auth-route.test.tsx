/* eslint-disable import/first */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockSendEmailCode = jest.fn();
const mockVerifyEmailCode = jest.fn();
const mockSignInWithPassword = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => `Redirect:${href}`,
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({
    emailBusy: null,
    error: null,
    clearError: jest.fn(),
    sendEmailCode: mockSendEmailCode,
    verifyEmailCode: mockVerifyEmailCode,
    signInWithPassword: mockSignInWithPassword,
  }),
}));

import EmailCodeRoute from "@/app/(auth)/email-code";
import EmailRoute from "@/app/(auth)/email";
import PasswordRoute from "@/app/(auth)/password";

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (node: React.ReactNode) => <SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>;

describe("Email OTP routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendEmailCode.mockResolvedValue(true);
    mockVerifyEmailCode.mockResolvedValue(true);
    mockSignInWithPassword.mockResolvedValue(true);
  });

  it("sends a code and preserves onboarding intent on the dedicated code route", async () => {
    mockParams = { intent: "onboarding" };
    const screen = await render(wrap(<EmailRoute />));
    await fireEvent.changeText(screen.getByLabelText("Email address"), "athlete@example.com");
    await fireEvent.press(screen.getByText("Send my code"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/(auth)/email-code?intent=onboarding&email=athlete%40example.com"));
  });

  it("verifies the code and routes the authenticated session through the root resolver", async () => {
    mockParams = { intent: "login", email: "athlete@example.com" };
    const screen = await render(wrap(<EmailCodeRoute />));
    await fireEvent.changeText(screen.getByLabelText("Six digit code"), "123456");
    await fireEvent.press(screen.getByText("Verify and sign in"));
    await waitFor(() => expect(mockVerifyEmailCode).toHaveBeenCalledWith("athlete@example.com", "123456"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("signs in with an existing password account and routes through the root resolver", async () => {
    const screen = await render(wrap(<PasswordRoute />));
    await fireEvent.changeText(screen.getByLabelText("Email address"), "appreview@formie.app");
    await fireEvent.changeText(screen.getByLabelText("Password"), "review-password");
    await fireEvent.press(screen.getByText("Sign in"));
    await waitFor(() => expect(mockSignInWithPassword).toHaveBeenCalledWith("appreview@formie.app", "review-password"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});
