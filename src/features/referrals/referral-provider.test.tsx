/* eslint-disable import/first */
import { Pressable, Text } from "react-native";
import { act, cleanup, fireEvent, render } from "@testing-library/react-native";

const mockAuth: { user: { id: string } | null; phase: "initializing" | "signed_out" | "authenticated" } = { user: null, phase: "signed_out" };
const mockPreviewCreatorCode = jest.fn();
const mockClaimReferral = jest.fn();
const mockLoadPendingReferral = jest.fn();
const mockSavePendingReferral = jest.fn();
const mockClearPendingReferral = jest.fn();

class MockReferralRequestError extends Error {
  constructor(message: string, readonly permanent: boolean) { super(message); }
}

jest.mock("@/features/auth/auth-provider", () => ({ useAuth: () => mockAuth }));
jest.mock("./api", () => ({
  previewCreatorCode: (...args: unknown[]) => mockPreviewCreatorCode(...args),
  claimReferral: (...args: unknown[]) => mockClaimReferral(...args),
  isPermanentReferralError: (error: unknown) => Boolean(error && typeof error === "object" && "permanent" in error && error.permanent === true),
}));
jest.mock("./referral-store", () => ({
  loadPendingReferral: (...args: unknown[]) => mockLoadPendingReferral(...args),
  savePendingReferral: (...args: unknown[]) => mockSavePendingReferral(...args),
  clearPendingReferral: (...args: unknown[]) => mockClearPendingReferral(...args),
}));

import { ReferralProvider, useReferral } from "./referral-provider";

const pending = { token: "token-one", visitId: "visit-1", creatorCode: "ALEX-7Q2K", creatorDisplayName: "Alex", issuedAt: "2026-09-01T00:00:00Z", expiresAt: "2026-09-30T00:00:00Z" };

function Harness() {
  const referral = useReferral();
  return <><Text testID="pending">{referral.pending?.creatorDisplayName ?? "none"}</Text><Text testID="error">{referral.validationError ?? "none"}</Text><Pressable testID="validate" onPress={() => void referral.validateCode("ALEX-7Q2K")}><Text>validate</Text></Pressable><Pressable testID="claim" onPress={() => void referral.claimPending()}><Text>claim</Text></Pressable></>;
}

async function mount() {
  const view = await render(<ReferralProvider><Harness /></ReferralProvider>);
  expect(mockLoadPendingReferral).toHaveBeenCalled();
  return view;
}

describe("ReferralProvider", () => {
  beforeEach(() => {
    mockAuth.user = null;
    mockAuth.phase = "signed_out";
    mockPreviewCreatorCode.mockReset();
    mockClaimReferral.mockReset();
    mockLoadPendingReferral.mockReset().mockResolvedValue(null);
    mockSavePendingReferral.mockReset().mockResolvedValue(undefined);
    mockClearPendingReferral.mockReset().mockResolvedValue(undefined);
    mockPreviewCreatorCode.mockResolvedValue(pending);
    mockClaimReferral.mockResolvedValue({ creatorDisplayName: "Alex", attributedAt: "2026-09-05T00:00:00Z" });
  });
  afterEach(() => cleanup());

  it("validates and persists a creator code before signup", async () => {
    const view = await mount();
    await act(async () => { fireEvent.press(view.getByTestId("validate")); await Promise.resolve(); });
    expect(view.getByTestId("pending").props.children).toBe("Alex");
    expect(mockPreviewCreatorCode).toHaveBeenCalledWith("ALEX-7Q2K");
    expect(mockSavePendingReferral).toHaveBeenCalledWith({ referral: pending, method: "creator_code", ownerUserId: null });
  });

  it("shows a validation error and does not persist an invalid code", async () => {
    mockPreviewCreatorCode.mockRejectedValue(new MockReferralRequestError("That creator code is invalid or unavailable.", true));
    const view = await mount();
    await act(async () => { fireEvent.press(view.getByTestId("validate")); await Promise.resolve(); });
    expect(view.getByTestId("pending").props.children).toBe("none");
    expect(view.getByTestId("error").props.children).toContain("invalid");
    expect(mockSavePendingReferral).not.toHaveBeenCalled();
  });

  it("restores a valid pending referral after an app restart", async () => {
    mockLoadPendingReferral.mockResolvedValue({ referral: pending, method: "creator_code", ownerUserId: null });
    const view = await mount();
    expect(view.getByTestId("pending").props.children).toBe("Alex");
  });

  it("does not accept a code for an existing authenticated account", async () => {
    mockAuth.user = { id: "existing-user" };
    mockAuth.phase = "authenticated";
    const view = await mount();
    await act(async () => { fireEvent.press(view.getByTestId("validate")); await Promise.resolve(); });
    expect(view.getByTestId("pending").props.children).toBe("none");
    expect(mockPreviewCreatorCode).not.toHaveBeenCalled();
  });

  it("retains the original token for an idempotent signup retry after a temporary claim failure", async () => {
    mockLoadPendingReferral.mockResolvedValue({ referral: pending, method: "creator_code", ownerUserId: null });
    mockAuth.user = { id: "user-1" };
    mockClaimReferral.mockRejectedValue(new MockReferralRequestError("offline", false));
    const view = await mount();
    await act(async () => { fireEvent.press(view.getByTestId("claim")); await Promise.resolve(); });
    expect(view.getByTestId("pending").props.children).toBe("Alex");
    expect(mockClearPendingReferral).not.toHaveBeenCalled();
  });

  it("clears an explicitly rejected token", async () => {
    mockLoadPendingReferral.mockResolvedValue({ referral: pending, method: "creator_code", ownerUserId: null });
    mockAuth.user = { id: "user-1" };
    mockClaimReferral.mockRejectedValue(new MockReferralRequestError("REFERRAL_EXPIRED", true));
    const view = await mount();
    await act(async () => { fireEvent.press(view.getByTestId("claim")); await Promise.resolve(); });
    expect(view.getByTestId("pending").props.children).toBe("none");
  });

  it("clears an account-owned pending referral when that account logs out", async () => {
    mockAuth.user = { id: "user-1" };
    mockAuth.phase = "authenticated";
    mockLoadPendingReferral.mockResolvedValue({ referral: pending, method: "creator_code", ownerUserId: "user-1" });
    const view = await mount();
    expect(view.getByTestId("pending").props.children).toBe("Alex");
    mockAuth.user = null;
    mockAuth.phase = "signed_out";
    await act(async () => { view.rerender(<ReferralProvider><Harness /></ReferralProvider>); await Promise.resolve(); });
    expect(mockClearPendingReferral).toHaveBeenCalled();
    expect(view.getByTestId("pending").props.children).toBe("none");
  });
});
