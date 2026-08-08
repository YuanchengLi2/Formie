import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { SubscriptionIntentModal } from "./subscription-intent-modal";

describe("SubscriptionIntentModal", () => {
  it("closes cancellation without mutating anything when the user says no", async () => {
    const onClose = jest.fn();
    const onExecute = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<SubscriptionIntentModal visible action="cancel" onClose={onClose} onExecute={onExecute} />);

    expect(screen.getByText("Are you sure you want to cancel your subscription?")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "No, keep subscription" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onExecute).not.toHaveBeenCalled();
  });

  it("asks for a reason after confirmation and executes with the selected reason", async () => {
    const onExecute = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<SubscriptionIntentModal visible action="cancel" onClose={jest.fn()} onExecute={onExecute} />);

    await fireEvent.press(screen.getByRole("button", { name: "Yes, cancel subscription" }));
    expect(screen.getByText("Why are you cancelling?")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Not using it enough" }));
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onExecute).toHaveBeenCalledWith("not_using_enough"));
  });

  it("confirms resume before executing without asking for a cancellation reason", async () => {
    const onExecute = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<SubscriptionIntentModal visible action="resume" onClose={jest.fn()} onExecute={onExecute} />);

    expect(screen.getByText("Are you sure you want to resubscribe?")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Yes, resubscribe" }));
    await waitFor(() => expect(onExecute).toHaveBeenCalledWith(undefined));
    expect(screen.queryByText("Why are you cancelling?")).toBeNull();
  });

  it("keeps the flow retryable when execution fails", async () => {
    const onExecute = jest.fn().mockRejectedValue(new Error("Provider unavailable"));
    const screen = await render(<SubscriptionIntentModal visible action="resume" onClose={jest.fn()} onExecute={onExecute} />);

    await fireEvent.press(screen.getByRole("button", { name: "Yes, resubscribe" }));
    await waitFor(() => expect(screen.getByText("Provider unavailable")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
