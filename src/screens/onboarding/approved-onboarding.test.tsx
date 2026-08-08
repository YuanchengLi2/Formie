import { act, fireEvent, render, within } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import { initialOnboardingAnswers, type OnboardingStep } from "@/features/onboarding/types";

import { ApprovedOnboardingScreen, getApprovedArtworkSize, getOnboardingDensity, type ApprovedOnboardingScreenProps } from "./approved-onboarding";

const mockSelectionAsync = jest.fn().mockResolvedValue(undefined);
const mockImpactAsync = jest.fn().mockResolvedValue(undefined);

jest.mock("expo-haptics", () => ({
  selectionAsync: (...args: unknown[]) => mockSelectionAsync(...args),
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  ImpactFeedbackStyle: { Light: "Light", Medium: "Medium" },
}));

async function renderStep(step: OnboardingStep, overrides: Partial<ApprovedOnboardingScreenProps> = {}) {
  const props: ApprovedOnboardingScreenProps = {
    step,
    answers: initialOnboardingAnswers,
    onAnswerChange: jest.fn(),
    onNext: jest.fn(),
    onBack: jest.fn(),
    onOAuth: jest.fn(),
    onEmail: jest.fn(),
    onRestoreAccount: jest.fn(),
    onOpenTerms: jest.fn(),
    onOpenPrivacy: jest.fn(),
    onPurchase: jest.fn(),
    onPurchasePlan: jest.fn(),
    price: "$9.99",
    purchaseAvailable: true,
    busy: false,
    ...overrides,
  };
  return { screen: await render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}><ApprovedOnboardingScreen {...props} /></SafeAreaProvider>), props };
}

const phoneMetrics: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

function loadingElement(props: ApprovedOnboardingScreenProps, onLoadingComplete: () => void) {
  return <SafeAreaProvider initialMetrics={phoneMetrics}><ApprovedOnboardingScreen {...props} step="loading" onLoadingComplete={onLoadingComplete} /></SafeAreaProvider>;
}

describe("approved onboarding screen", () => {
  beforeEach(() => {
    mockSelectionAsync.mockClear();
    mockImpactAsync.mockClear();
  });

  it("compresses layout from usable safe-area height on standard and small phones", () => {
    expect(getOnboardingDensity(844, 47, 34)).toEqual({ compact: true, short: false });
    expect(getOnboardingDensity(667, 20, 0)).toEqual({ compact: true, short: true });
    expect(getOnboardingDensity(932, 59, 34)).toEqual({ compact: false, short: false });
  });
  it.each([
    ["age", "How old are you?"],
    ["gender", "What is your gender?"],
    ["height", "How tall are you?"],
    ["weight", "What do you weigh?"],
    ["experience", "How experienced are you?"],
    ["primary-goal", "What’s your primary goal?"],
    ["biggest-frustration", "What frustrates you most?"],
    ["training-frequency", "How often do you train?"],
    ["custom-milestone", "What goal are you working toward?"],
    ["acquisition-source", "Where did you hear about Formie?"],
    ["create-account", "Save your progress"],
    ["premium", "Formie plans paywall"],
  ] as const)("renders the approved %s content without a pictured phone frame", async (step, copy) => {
    const { screen } = await renderStep(step);

    expect(step === "premium" ? screen.getByLabelText(/Formie plans paywall/) : screen.getByText(copy)).toBeTruthy();
    expect(screen.queryByTestId("phone-frame")).toBeNull();
  });

  it("removes the redundant product-demonstration close copy", async () => {
    const { screen } = await renderStep("product-demonstration");
    expect(screen.queryByText("See what happened. Know what changes.")).toBeNull();
  });

  it.each(["product-value", "why-formie", "product-demonstration", "long-term-value", "loading"] as const)("renders native copy around the phone-free %s artwork", async (step) => {
    const { screen } = await renderStep(step);
    const image = screen.getByTestId(`approved-illustration-${step}`);
    expect(image.props.contentFit).toBe("contain");
    expect(screen.getByText(copyForStep[step].title)).toBeTruthy();
    expect(screen.getByText(copyForStep[step].subtitle)).toBeTruthy();
    expect(screen.queryByTestId(`approved-artwork-${step}`)).toBeNull();
    expect(screen.queryByTestId("phone-frame")).toBeNull();
    expect(screen.queryByTestId("screenshot-cta-overlay")).toBeNull();
  });

  it("advances from Welcome and preserves an explicit back action on question screens", async () => {
    const welcome = await renderStep("welcome");
    await fireEvent.press(welcome.screen.getByText("Get Started"));
    expect(welcome.props.onNext).toHaveBeenCalledTimes(1);
    await welcome.screen.unmount();

    const age = await renderStep("age");
    await fireEvent.press(age.screen.getByLabelText("Back"));
    expect(age.props.onBack).toHaveBeenCalledTimes(1);
  });

  it("renders Welcome from the exact approved frame-free composition", async () => {
    const { screen } = await renderStep("welcome");

    const image = screen.getByTestId("approved-illustration-welcome");
    expect(image.props.contentFit).toBe("contain");
    expect(screen.queryByTestId("welcome-native-artwork")).toBeNull();
    expect(screen.queryByLabelText("Welcome lifting artwork")).toBeNull();
  });

  it("shows an unboxed sign-in text action above the prominent welcome CTA", async () => {
    const onSignIn = jest.fn();
    const { screen } = await renderStep("welcome", { onSignIn });
    const button = screen.getByRole("button", { name: "Already have an account? Sign in" });
    expect(button).toHaveStyle({ minHeight: 44, backgroundColor: "transparent" });
    expect(screen.getByText("Already have an account? Sign in")).toBeTruthy();
    await fireEvent.press(button);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("makes Get Started larger than a normal Continue CTA", async () => {
    const welcome = await renderStep("welcome");
    expect(welcome.screen.getByTestId("onboarding-bottom-cta")).toHaveStyle({ minHeight: 64 });
    await welcome.screen.unmount();

    const next = await renderStep("product-value");
    expect(next.screen.getByTestId("onboarding-bottom-cta")).not.toHaveStyle({ minHeight: 64 });
  });

  it.each([
    [375, 667],
    [390, 844],
    [430, 932],
  ])("bounds every approved illustration inside a %sx%s phone", (width, height) => {
    for (const step of ["welcome", "product-value", "why-formie", "product-demonstration", "long-term-value"] as const) {
      const size = getApprovedArtworkSize(step, width, height);
      expect(size.width).toBeLessThanOrEqual(width - 32);
      const heightLimit = step === "product-value" || step === "product-demonstration" ? 0.64 : 0.58;
      expect(size.height).toBeLessThanOrEqual(height * heightLimit);
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    }
  });

  it("renders the second-page and decoded-lift artwork prominently on a standard phone", () => {
    const productValue = getApprovedArtworkSize("product-value", 390, 844);
    const decodedLift = getApprovedArtworkSize("product-demonstration", 390, 844);

    expect(productValue.width).toBeGreaterThanOrEqual(340);
    expect(productValue.height).toBeGreaterThanOrEqual(470);
    expect(decodedLift.width).toBeGreaterThanOrEqual(335);
    expect(decodedLift.height).toBeGreaterThanOrEqual(500);
  });

  it.each([
    ["product-value", "product-value-native-artwork"],
    ["why-formie", "personalized-coaching-native-artwork"],
    ["product-demonstration", "product-demonstration-native-artwork"],
    ["long-term-value", "progress-history-native-artwork"],
  ] as const)("renders the approved PNG directly on %s", async (step, oldTestID) => {
    const { screen } = await renderStep(step);
    const image = screen.getByTestId(`approved-illustration-${step}`);
    expect(image.props.contentFit).toBe("contain");
    expect(screen.queryByTestId(oldTestID)).toBeNull();
  });

  it("renders four larger goal choices with visible icons", async () => {
    const { screen } = await renderStep("primary-goal");

    expect(screen.getAllByLabelText(/choice icon$/)).toHaveLength(4);
    for (const card of screen.getAllByRole("radio")) expect(card).toHaveStyle({ minHeight: 124 });
  });

  it.each(["primary-goal", "biggest-frustration"] as const)("uses illustrated cards for every %s choice", async (step) => {
    const { screen } = await renderStep(step);
    const radios = screen.getAllByRole("radio");
    expect(screen.getAllByLabelText(/choice icon$/)).toHaveLength(radios.length);
    for (const card of radios) expect(card).toHaveStyle({ minHeight: 124 });
  });

  it("keeps the simpler gender and experience rows faithful to the approved designs", async () => {
    const gender = await renderStep("gender");
    expect(gender.screen.queryAllByLabelText(/choice icon$/)).toHaveLength(0);
    for (const card of gender.screen.getAllByRole("radio")) expect(card).toHaveStyle({ minHeight: 76 });
    await gender.screen.unmount();

    const experience = await renderStep("experience");
    expect(experience.screen.queryAllByLabelText(/choice icon$/)).toHaveLength(0);
    expect(experience.screen.getByText("1–3 YEARS")).toBeTruthy();
  });

  it("shows preparation steps and completes even while its parent rerenders", async () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();
    const first = await renderStep("loading", { onLoadingComplete: () => onComplete() });

    expect(first.screen.getByText("Personalizing your coaching")).toBeTruthy();
    expect(first.screen.queryByTestId("loading-spinner")).toBeNull();
    await act(async () => { jest.advanceTimersByTime(1_350); });
    expect(first.screen.getByText("Saving your goals")).toBeTruthy();
    await first.screen.rerender(loadingElement(first.props, () => onComplete()));
    await act(async () => { jest.advanceTimersByTime(1_350); });
    expect(first.screen.getByText("Finishing your profile")).toBeTruthy();
    await first.screen.rerender(loadingElement(first.props, () => onComplete()));
    await act(async () => { jest.advanceTimersByTime(1_350); });
    expect(onComplete).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("records selected values rather than displaying fixed reference answers", async () => {
    const onAnswerChange = jest.fn();
    const age = await renderStep("age", { onAnswerChange });
    await fireEvent.press(age.screen.getByText("19"));
    expect(onAnswerChange).toHaveBeenCalledWith("ageYears", 19);
    await age.screen.unmount();

    const gender = await renderStep("gender", { onAnswerChange });
    await fireEvent.press(gender.screen.getByText("Female"));
    expect(onAnswerChange).toHaveBeenCalledWith("gender", "female");
    await gender.screen.unmount();

    const frequency = await renderStep("training-frequency", { onAnswerChange });
    await fireEvent.press(frequency.screen.getByLabelText("6 workouts per week"));
    expect(onAnswerChange).toHaveBeenCalledWith("workoutsPerWeek", 6);
  });

  it("uses a single native visual layer instead of rendering screenshot controls underneath", async () => {
    const age = await renderStep("age", { answers: { ...initialOnboardingAnswers, ageYears: 19 } });

    expect(age.screen.queryByTestId("approved-reference-age")).toBeNull();
    expect(age.screen.getByTestId("onboarding-native-surface")).toBeTruthy();
    expect(age.screen.getByTestId("onboarding-age-value").props.accessibilityValue.text).toBe("19");

    await age.screen.unmount();

    const gender = await renderStep("gender", { answers: { ...initialOnboardingAnswers, gender: "female" } });
    expect(gender.screen.getByRole("radio", { name: "Female" }).props.accessibilityState.selected).toBe(true);
  });

  it("keeps native onboarding adaptive with a smaller reachable CTA", async () => {
    const { screen } = await renderStep("primary-goal");

    expect(screen.getByTestId("onboarding-scaffold")).toBeTruthy();
    expect(screen.getByTestId("onboarding-content")).toHaveStyle({ flex: 1 });
    expect(screen.getByTestId("onboarding-scroll-body")).toBeTruthy();
    expect(screen.getByTestId("onboarding-bottom-cta")).toHaveStyle({ minHeight: 56 });
    expect(screen.queryByText(/\d{2} \/ 19/)).toBeNull();
  });

  it("has no username screen or username input", async () => {
    const { screen } = await renderStep("create-account");
    expect(screen.queryByLabelText("Username")).toBeNull();
    expect(screen.queryByText(/choose your username/i)).toBeNull();
  });

  it.each(["age", "height", "weight", "training-frequency"] as const)("supports adaptive page scrolling around the %s gesture control", async (step) => {
    const { screen } = await renderStep(step);
    expect(screen.getByTestId("onboarding-scroll-body")).toBeTruthy();
  });

  it("requires legal consent but keeps marketing optional before saving with a provider", async () => {
    const { screen, props } = await renderStep("create-account");
    expect(screen.queryAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Sign in with Apple" }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText("Agree to the Terms of Use and Privacy Policy"));
    await fireEvent.press(screen.getByRole("button", { name: "Sign in with Apple" }));
    expect(props.onAnswerChange).toHaveBeenCalledWith("acceptedPrivacy", true);
    expect(props.onAnswerChange).not.toHaveBeenCalledWith("marketingOptIn", true);
    expect(props.onOAuth).toHaveBeenCalledWith("apple");
  });

  it("keeps legal links outside the consent checkbox targets", async () => {
    const { screen } = await renderStep("create-account");
    expect(within(screen.getByLabelText("Agree to the Terms of Use and Privacy Policy")).queryByRole("link")).toBeNull();
    expect(within(screen.getByLabelText("Receive Formie tips and offers")).queryByRole("link")).toBeNull();
  });

  it("provides haptics for navigation, options, and wheel selections", async () => {
    const welcome = await renderStep("welcome");
    await fireEvent.press(welcome.screen.getByText("Get Started"));
    expect(mockImpactAsync).toHaveBeenCalledWith("Medium");
    await welcome.screen.unmount();

    const gender = await renderStep("gender");
    await fireEvent.press(gender.screen.getByText("Female"));
    expect(mockSelectionAsync).toHaveBeenCalled();
    await gender.screen.unmount();

    mockSelectionAsync.mockClear();
    const age = await renderStep("age", { answers: { ...initialOnboardingAnswers, ageYears: 18 } });
    fireEvent(age.screen.getByTestId("onboarding-age-wheel"), "momentumScrollEnd", { nativeEvent: { contentOffset: { y: 378 } } });
    expect(mockSelectionAsync).toHaveBeenCalledTimes(1);
  });

  it("supports real wheel scrolling instead of requiring value taps", async () => {
    const onAnswerChange = jest.fn();
    const { screen } = await renderStep("age", {
      answers: { ...initialOnboardingAnswers, ageYears: 18 },
      onAnswerChange,
    });
    const wheel = screen.getByTestId("onboarding-age-wheel");

    expect(wheel.props.scrollEnabled).not.toBe(false);
    fireEvent.scroll(wheel, { nativeEvent: { contentOffset: { y: 378 } } });
    expect(onAnswerChange).not.toHaveBeenCalled();
    fireEvent(wheel, "momentumScrollEnd", { nativeEvent: { contentOffset: { y: 378 } } });
    expect(onAnswerChange).toHaveBeenCalledWith("ageYears", 20);
  });

  it("exposes training frequency as an adjustable slider", async () => {
    const onAnswerChange = jest.fn();
    const { screen } = await renderStep("training-frequency", {
      answers: { ...initialOnboardingAnswers, workoutsPerWeek: 4 },
      onAnswerChange,
    });
    const slider = screen.getByLabelText("Workouts per week");

    fireEvent(slider, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(onAnswerChange).toHaveBeenCalledWith("workoutsPerWeek", 5);
  });

  it("shows account connection and purchase errors/progress on the live screens", async () => {
    const account = await renderStep("create-account", { busy: true, error: "The provider could not connect." });
    expect(account.screen.getByText("Connecting…")).toBeTruthy();
    expect(account.screen.getByRole("alert")).toHaveTextContent("The provider could not connect.");
    await account.screen.unmount();

    const premium = await renderStep("premium", { busy: true, error: "The purchase could not be completed." });
    expect(premium.screen.getByRole("button", { name: "Starting..." })).toBeTruthy();
    expect(premium.screen.getByRole("alert")).toHaveTextContent("The purchase could not be completed.");
  });

  it("supports metric entry and limits the custom milestone to 60 characters", async () => {
    const onAnswerChange = jest.fn();
    const height = await renderStep("height", { onAnswerChange });
    await fireEvent.press(height.screen.getByText("cm"));
    expect(onAnswerChange).toHaveBeenCalledWith("measurementSystem", "metric");
    await height.screen.unmount();

    const milestone = await renderStep("custom-milestone", { onAnswerChange });
    const input = milestone.screen.getByLabelText("Your goal");
    expect(input.props.maxLength).toBe(60);
    await fireEvent.changeText(input, "Bench 225 lb");
    expect(onAnswerChange).toHaveBeenCalledWith("customMilestone", "Bench 225 lb");
  });

  it("uses a large full-width icon list for acquisition choices", async () => {
    const onAnswerChange = jest.fn();
    const unanswered = await renderStep("acquisition-source", { onAnswerChange });

    for (const label of ["TikTok", "Instagram", "YouTube", "App Store search", "Google search", "Friend, trainer, or coach", "Other"]) {
      expect(unanswered.screen.getByRole("radio", { name: label })).toHaveStyle({ width: "100%", minHeight: 62 });
    }
    expect(unanswered.screen.getAllByLabelText(/source icon$/)).toHaveLength(7);
    expect(unanswered.screen.getByTestId("onboarding-scroll-body")).toBeTruthy();
    expect(unanswered.screen.getByTestId("onboarding-bottom-cta").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(unanswered.screen.getByRole("radio", { name: "Other" }));
    expect(onAnswerChange).toHaveBeenCalledWith("acquisitionSource", "other");
    await unanswered.screen.unmount();

    const other = await renderStep("acquisition-source", {
      answers: { ...initialOnboardingAnswers, acquisitionSource: "other" },
      onAnswerChange,
    });
    const input = other.screen.getByLabelText("Where did you hear about Formie? Other response");
    expect(input.props.maxLength).toBe(80);
    expect(other.screen.getByTestId("onboarding-bottom-cta").props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(input, "Local trainer");
    expect(onAnswerChange).toHaveBeenCalledWith("acquisitionSourceOther", "Local trainer");
  });

  it("offers Apple, Google, and Email on the shared account screen", async () => {
    const { screen, props } = await renderStep("create-account", { answers: { ...initialOnboardingAnswers, acceptedPrivacy: true } });

    await fireEvent.press(screen.getByLabelText("Agree to the Terms of Use and Privacy Policy"));
    await fireEvent.press(screen.getByText("Sign in with Apple"));
    await fireEvent.press(screen.getByText("Sign in with Google"));
    await fireEvent.press(screen.getByText("Continue with email"));

    expect(props.onOAuth).toHaveBeenNthCalledWith(1, "apple");
    expect(props.onOAuth).toHaveBeenNthCalledWith(2, "google");
    expect(props.onEmail).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Restore account")).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.getByText("Continue with email")).toBeTruthy();
  });

  it("uses the live premium price and purchase action without a skip", async () => {
    const { screen, props } = await renderStep("premium", { price: "$12.49" });

    expect(screen.getByLabelText(/Formie plans paywall/)).toBeTruthy();
    expect(screen.queryByText("Skip")).toBeNull();
    expect(screen.queryByText("Restore Purchase")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Start monthly - $12.49/mo" }));
    expect(props.onPurchasePlan).toHaveBeenCalledWith("monthly");
  });

  it("disables purchase when RevenueCat has no live monthly package", async () => {
    const { screen, props } = await renderStep("premium", { price: "Unavailable", purchaseAvailable: false });
    const purchaseButton = screen.getByRole("button", { name: /^Start monthly/ });

    expect(purchaseButton.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(purchaseButton);
    expect(props.onPurchasePlan).not.toHaveBeenCalled();
  });

  it("uses the latest supplied reference paywall composition", async () => {
    const { screen } = await renderStep("premium", { price: "$9.99" });

    expect(screen.getByTestId("premium-reference-image")).toBeTruthy();
    expect(screen.getByLabelText(/Formie plans paywall/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Monthly" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Yearly" })).toBeNull();
    expect(screen.queryByTestId("approved-premium-screenshot")).toBeNull();
  });

  it("exposes the reference paywall content to accessibility", async () => {
    const { screen } = await renderStep("premium");

    const summary = screen.getByLabelText(/Formie plans paywall/).props.accessibilityLabel;
    expect(summary).toContain("Upgrade to Formie Pro");
    expect(summary).toContain("AI form analysis for serious lifters");
    expect(summary).toContain("10 analyses every month");
    expect(summary).toContain("AI Form Analysis");
    expect(summary).toContain("Personalized Feedback");
    expect(summary).toContain("Progress Tracking");
    expect(summary).toContain("Formie Coach");
    expect(summary).toContain("Continue with Pro");
    expect(summary).toContain("Secure payment");
    expect(screen.getByLabelText(/Formie plans paywall/).props.accessibilityLabel).toContain("Trusted by 1,000+ lifters");
    expect(summary).toContain("Real progress. Real results.");
  });

  it("renders the supplied reference image as the full paywall surface", async () => {
    const { screen } = await renderStep("premium");

    expect(screen.getByTestId("premium-reference-image").props.contentFit).toBe("fill");
  });

  it("always purchases the monthly package", async () => {
    const { screen, props } = await renderStep("premium");
    await fireEvent.press(screen.getByRole("button", { name: "Start monthly - $9.99/mo" }));
    expect(props.onPurchasePlan).toHaveBeenCalledWith("monthly");
  });
});

const copyForStep = {
  welcome: { title: "FORMIE", subtitle: "Your personal AI lifting coach." },
  "product-value": { title: "Stop guessing your form.", subtitle: "See exactly what happened—and what to do next." },
  "why-formie": { title: "Your lift isn’t generic.", subtitle: "So your feedback shouldn’t be either." },
  "product-demonstration": { title: "Your lift, fully decoded.", subtitle: "Formie finds the moment, explains it, and gives you the next move." },
  "long-term-value": { title: "Every set adds context.", subtitle: "See whether the same cue is getting easier, cleaner, and more consistent." },
  loading: { title: "Building your profile...", subtitle: "Combining your goals, experience, and training context." },
} as const;
