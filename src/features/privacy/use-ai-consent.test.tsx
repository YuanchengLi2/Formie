/* eslint-disable import/first */
import { Pressable, Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render } from "@testing-library/react-native";

import { AI_PROCESSING_NOTICE_SHA256, AI_PROCESSING_NOTICE_VERSION } from "./ai-consent";

const mockRpc = jest.fn();
let mockUserId: string | null = "user-1";

jest.mock("@/lib/supabase", () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));
jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => ({ phase: mockUserId ? "authenticated" : "signed_out", user: mockUserId ? { id: mockUserId } : null }),
}));

import { runAiConsentOperationOnce, useAiConsent } from "./use-ai-consent";

function Probe() {
  const consent = useAiConsent();
  return <>
    <Text>{consent.status}</Text>
    <Text>{consent.current ? "agreed" : "withdrawn"}</Text>
    <Text>{consent.version ?? "no-version"}</Text>
    <Text>{consent.error ?? "no-error"}</Text>
    <Pressable onPress={() => void consent.accept()}><Text>Accept</Text></Pressable>
    <Pressable onPress={() => void consent.revoke()}><Text>Revoke</Text></Pressable>
  </>;
}

const activeRow = (acceptedAt: string) => ({
  version: AI_PROCESSING_NOTICE_VERSION,
  notice_sha256: AI_PROCESSING_NOTICE_SHA256,
  accepted_at: acceptedAt,
  revoked_at: null,
});

describe("useAiConsent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = "user-1";
  });

  it("updates every consumer through the shared cache across revoke and re-consent", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: [activeRow("2026-09-03T10:00:00.000Z")], error: null })
      .mockResolvedValueOnce({ data: "2026-09-03T11:00:00.000Z", error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [activeRow("2026-09-03T12:00:00.000Z")], error: null })
      .mockResolvedValueOnce({ data: [activeRow("2026-09-03T12:00:00.000Z")], error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
    const screen = await render(<QueryClientProvider client={client}><Probe /><Probe /></QueryClientProvider>);

    expect((await screen.findAllByText("agreed")).length).toBe(2);
    await act(async () => fireEvent.press(screen.getAllByText("Revoke")[0]));
    expect((await screen.findAllByText("withdrawn")).length).toBe(2);

    await act(async () => fireEvent.press(screen.getAllByText("Accept")[1]));
    expect((await screen.findAllByText("agreed")).length).toBe(2);
    expect((await screen.findAllByText(AI_PROCESSING_NOTICE_VERSION)).length).toBe(2);
  });

  it("deduplicates concurrent accepts", async () => {
    let resolveAccept!: () => void;
    const operation = jest.fn(() => new Promise<void>((resolve) => { resolveAccept = resolve; }));
    const first = runAiConsentOperationOnce("user-1:accept", operation);
    const second = runAiConsentOperationOnce("user-1:accept", operation);

    expect(second).toBe(first);
    expect(operation).toHaveBeenCalledTimes(1);
    resolveAccept();
    await Promise.all([first, second]);
  });

  it("stays idle while signed out", async () => {
    mockUserId = null;
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
    const screen = await render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
    expect(screen.getByText("ready")).toBeTruthy();
    expect(screen.getByText("withdrawn")).toBeTruthy();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
