import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { FeedbackScreen } from ".";

describe("FeedbackScreen", () => {
  it("requires a 20 character message and submits a selected category", async () => {
    const onSubmit = jest.fn(async () => ({ submitted: true as const, requestId: "request-1" }));
    const screen = await render(<FeedbackScreen onSubmit={onSubmit} />);

    expect(screen.getByLabelText("Send feedback")).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Feedback message"), "This feedback is long enough.");
    await fireEvent.press(screen.getByText("Feature request"));
    await fireEvent.press(screen.getByLabelText("Send feedback"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      category: "feature_request",
      message: "This feedback is long enough.",
    }));
    expect(screen.getByText("Thanks — your feedback was sent.")).toBeTruthy();
  });

  it("keeps the message available for retry after a send failure", async () => {
    const onSubmit = jest.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ submitted: true, requestId: "request-1" });
    const screen = await render(<FeedbackScreen onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByLabelText("Feedback message"), "The timeline is not loading for me.");
    await fireEvent.press(screen.getByLabelText("Send feedback"));
    await waitFor(() => expect(screen.getByText("Feedback could not be sent. Try again.")).toBeTruthy());
    expect(screen.getByDisplayValue("The timeline is not loading for me.")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Send feedback"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  });
});
