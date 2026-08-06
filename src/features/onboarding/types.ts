export const onboardingSteps = [
  "welcome",
  "age",
  "product-value",
  "gender",
  "height",
  "why-formie",
  "weight",
  "experience",
  "product-demonstration",
  "primary-goal",
  "biggest-frustration",
  "training-frequency",
  "custom-milestone",
  "acquisition-source",
  "long-term-value",
  "loading",
  "create-account",
  "premium",
] as const;

export type OnboardingStep = (typeof onboardingSteps)[number];

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === "string" && (onboardingSteps as readonly string[]).includes(value);
}

export function nextOnboardingStep(step: OnboardingStep): OnboardingStep | null {
  const index = onboardingSteps.indexOf(step);
  return index >= 0 && index < onboardingSteps.length - 1 ? onboardingSteps[index + 1] : null;
}

export function previousOnboardingStep(step: OnboardingStep): OnboardingStep | null {
  const index = onboardingSteps.indexOf(step);
  return index > 0 ? onboardingSteps[index - 1] : null;
}
export type Gender = "male" | "female" | "prefer_not_to_say";
export type MeasurementSystem = "imperial" | "metric";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type PrimaryGoal = "build_muscle" | "get_stronger" | "lose_weight" | "improve_technique";
export type BiggestFrustration = "plateau" | "unsure_form" | "discomfort" | "lack_confidence";
export type AcquisitionSource = "tiktok" | "instagram" | "youtube" | "app_store_search" | "google_search" | "friend_trainer_coach" | "other";
export type OAuthIntent = "login" | "create_account";
export type OnboardingStatus =
  | "collecting"
  | "account_required"
  | "profile_sync_required"
  | "premium_required"
  | "complete";

export type OnboardingAnswers = {
  ageYears: number | null;
  gender: Gender | null;
  heightCm: number | null;
  weightKg: number | null;
  measurementSystem: MeasurementSystem;
  experience: ExperienceLevel | null;
  primaryGoal: PrimaryGoal | null;
  biggestFrustration: BiggestFrustration | null;
  workoutsPerWeek: number;
  customMilestone: string;
  acquisitionSource: AcquisitionSource | null;
  acquisitionSourceOther: string;
  acceptedPrivacy: boolean;
  marketingOptIn: boolean;
};

export type OnboardingState = {
  schemaVersion: 5;
  onboardingVersion: "approved-v1";
  ownerUserId: string | null;
  currentStep: OnboardingStep;
  answers: OnboardingAnswers;
  status: OnboardingStatus;
  oauthIntent: OAuthIntent | null;
  explicitLogoutAt: string | null;
};

export const initialOnboardingAnswers: OnboardingAnswers = {
  ageYears: null,
  gender: null,
  heightCm: null,
  weightKg: null,
  measurementSystem: "imperial",
  experience: null,
  primaryGoal: null,
  biggestFrustration: null,
  workoutsPerWeek: 4,
  customMilestone: "",
  acquisitionSource: null,
  acquisitionSourceOther: "",
  acceptedPrivacy: false,
  marketingOptIn: false,
};

export const initialOnboardingState: OnboardingState = {
  schemaVersion: 5,
  onboardingVersion: "approved-v1",
  ownerUserId: null,
  currentStep: "welcome",
  answers: initialOnboardingAnswers,
  status: "collecting",
  oauthIntent: null,
  explicitLogoutAt: null,
};

export type OnboardingAction =
  | { type: "answer_changed"; field: keyof OnboardingAnswers; value: OnboardingAnswers[keyof OnboardingAnswers] }
  | { type: "step_viewed"; step: OnboardingStep }
  | { type: "account_required" }
  | { type: "oauth_started"; intent: OAuthIntent }
  | { type: "auth_succeeded"; userId: string }
  | { type: "profile_sync_succeeded" }
  | { type: "access_granted"; userId?: string | null }
  | { type: "new_account_started" }
  | { type: "logged_out"; at?: string };

export function reduceOnboardingState(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case "answer_changed":
      return {
        ...state,
        answers: { ...state.answers, [action.field]: action.value },
      };
    case "step_viewed":
      return { ...state, currentStep: action.step, status: "collecting" };
    case "account_required":
      return { ...state, currentStep: "create-account", status: "account_required" };
    case "oauth_started":
      return { ...state, oauthIntent: action.intent };
    case "auth_succeeded":
      return { ...state, ownerUserId: action.userId, currentStep: "create-account", status: "profile_sync_required" };
    case "profile_sync_succeeded":
      return { ...state, currentStep: "premium", status: "premium_required" };
    case "access_granted":
      return {
        ...state,
        ownerUserId: action.userId ?? state.ownerUserId,
        status: "complete",
        oauthIntent: null,
        explicitLogoutAt: null,
      };
    case "new_account_started":
      return { ...initialOnboardingState, answers: { ...initialOnboardingAnswers } };
    case "logged_out":
      return { ...state, explicitLogoutAt: action.at ?? new Date().toISOString() };
    default:
      return state;
  }
}

export function loggedOutOnboardingState(at = new Date().toISOString()): OnboardingState {
  return {
    ...initialOnboardingState,
    answers: { ...initialOnboardingAnswers },
    explicitLogoutAt: at,
  };
}

export function onboardingNeedsIntro(state: OnboardingState): boolean {
  return state.status === "collecting" && state.currentStep === "welcome" && !state.explicitLogoutAt;
}

export function resolveOnboardingStateForUser(
  scopedState: OnboardingState | null,
  signedOutState: OnboardingState,
  userId: string,
): OnboardingState {
  if (scopedState?.ownerUserId === userId) return scopedState;
  if (signedOutState.status === "account_required" || signedOutState.oauthIntent === "create_account") {
    return reduceOnboardingState(signedOutState, { type: "auth_succeeded", userId });
  }
  return { ...initialOnboardingState, answers: { ...initialOnboardingAnswers }, ownerUserId: userId };
}
