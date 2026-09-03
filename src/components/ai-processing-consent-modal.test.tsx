import { fireEvent, render } from "@testing-library/react-native";

import { AiProcessingConsentModal } from "./ai-processing-consent-modal";

describe("AiProcessingConsentModal", () => {
  it("identifies the data, paid Gemini processor, purpose, retention, and controls", async () => {
    const screen = await render(
      <AiProcessingConsentModal visible onAgree={jest.fn()} onDismiss={jest.fn()} />,
    );

    expect(screen.getByText(/exercise video, exercise declaration/)).toBeTruthy();
    expect(screen.getByText(/paid Google Gemini API/)).toBeTruthy();
    expect(screen.getByText(/abuse and safety monitoring/)).toBeTruthy();
    expect(screen.getByText(/withdraw consent for future analyses/)).toBeTruthy();
  });

  it("requires an affirmative action and keeps dismissal separate", async () => {
    const onAgree = jest.fn();
    const onDismiss = jest.fn();
    const screen = await render(
      <AiProcessingConsentModal visible onAgree={onAgree} onDismiss={onDismiss} />,
    );

    fireEvent.press(screen.getByLabelText("Not now"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAgree).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText("Agree and continue"));
    expect(onAgree).toHaveBeenCalledTimes(1);
  });
});
