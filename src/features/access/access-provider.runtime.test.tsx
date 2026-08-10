/* eslint-disable import/first */
import { Pressable, Text } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";

const mockRpc = jest.fn();
const mockChannel = {
  on: jest.fn(),
  subscribe: jest.fn(),
};
mockChannel.on.mockReturnValue(mockChannel);
mockChannel.subscribe.mockReturnValue(mockChannel);
const mockRemoveChannel = jest.fn();
const mockAuth = {
  phase: "authenticated",
  user: { id: "user-1" },
  session: { access_token: "access-token" },
};

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => mockAuth,
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: jest.fn(() => mockChannel),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

import { AccessProvider, useAccess } from "./access-provider";

function Probe() {
  const access = useAccess();
  return <><Text>{`${access.status}:${access.access.status}`}</Text><Pressable testID="refresh-access" onPress={() => void access.refresh()}><Text>Refresh access</Text></Pressable></>;
}

describe("AccessProvider runtime lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockResolvedValue({
      data: {
        status: "active",
        lifecycle_state: "active_renewing",
        can_analyze: true,
        remaining: 10,
        quota_limit: 10,
        store: "app_store",
        source: "revenuecat",
      },
      error: null,
    });
  });

  it("keeps the resolved access snapshot ready instead of restarting the load cycle", async () => {
    const screen = await render(<AccessProvider><Probe /></AccessProvider>);
    expect(await screen.findByText("ready:active")).toBeTruthy();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByText("ready:active")).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it("subscribes to Test Store scenario changes so website controls refresh the app", async () => {
    await render(<AccessProvider><Probe /></AccessProvider>);

    expect(mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ table: "subscription_test_scenarios", filter: "user_id=eq.user-1" }),
      expect.any(Function),
    );
  });

  it("keeps the confirmed access snapshot visible when the server reports pending renewal", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        status: "active",
        lifecycle_state: "active_renewing",
        can_analyze: false,
        remaining: 0,
        quota_limit: 10,
        store: "app_store",
        source: "revenuecat",
      },
      error: null,
    }).mockResolvedValueOnce({
      data: {
        status: "unknown",
        lifecycle_state: "renewal_pending",
        can_analyze: false,
        remaining: 0,
        quota_limit: 10,
        store: "app_store",
        source: "revenuecat",
      },
      error: null,
    });

    const screen = await render(<AccessProvider><Probe /></AccessProvider>);
    expect(await screen.findByText("ready:active")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId("refresh-access"));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(screen.getByText("ready:active")).toBeTruthy();
    expect(screen.queryByText("ready:unknown")).toBeNull();
    screen.unmount();
  });
});
