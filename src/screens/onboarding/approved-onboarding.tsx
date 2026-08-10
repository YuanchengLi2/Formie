import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { heightToCm, weightToKg } from "@/features/onboarding/onboarding-schema";
import { onboardingSteps, type OnboardingAnswers, type OnboardingStep } from "@/features/onboarding/types";
import type { PurchaseState } from "@/features/billing/types";
import { AccountAccessScreen } from "@/components/account-access-screen";
import { onboardingTheme } from "@/theme/onboarding";
import { PremiumScreen } from "./premium-screen";

type Provider = "apple" | "google";

export type ApprovedOnboardingScreenProps = {
  step: OnboardingStep;
  answers: OnboardingAnswers;
  onAnswerChange: (field: keyof OnboardingAnswers, value: OnboardingAnswers[keyof OnboardingAnswers]) => void;
  onNext: () => void;
  onBack: () => void;
  onOAuth: (provider: Provider) => void;
  onEmail: () => void;
  onRestoreAccount: () => void;
  onSignIn?: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onPurchase: () => void;
  onPurchasePlan?: (plan: "monthly") => void;
  onLogOut?: () => void;
  price: string;
  purchaseAvailable: boolean;
  busy: boolean;
  busyProvider?: Provider | null;
  error?: string | null;
  purchaseState?: PurchaseState;
  onRetrySync?: () => void;
  onLoadingComplete?: () => void;
};

const logo = require("../../../assets/images/form-logo-mark.png");
const goldGradient = require("../../../assets/production/onboarding/gold-gradient.png");
const approvedArtwork = {
  welcome: require("../../../assets/production/onboarding/extracted/01-welcome-illustration.png"),
  "product-value": require("../../../assets/production/onboarding/extracted/03-product-value-illustration.png"),
  "why-formie": require("../../../assets/production/onboarding/extracted/06-why-formie-illustration.png"),
  "product-demonstration": require("../../../assets/production/onboarding/extracted/09-product-demonstration-center.png"),
  "long-term-value": require("../../../assets/production/onboarding/extracted/14-long-term-value-illustration.png"),
  loading: require("../../../assets/production/onboarding/extracted/15-loading-illustration.png"),
} as const;
const productDemonstrationCoachingOverlay = require("../../../assets/production/onboarding/generated/product-demonstration-coaching-overlay.png");

type ApprovedArtworkStep = keyof typeof approvedArtwork;

const copy: Record<OnboardingStep, { title: string; subtitle: string; eyebrow?: string }> = {
  welcome: { title: "Your personal AI lifting coach.", subtitle: "Record your set. See what happened. Know exactly what to do next.", eyebrow: "FORM CHECK" },
  age: { title: "How old are you?", subtitle: "This helps Formie tailor your coaching to your training stage." },
  "product-value": { title: "Stop guessing your form.", subtitle: "See exactly what happened—and what to do next." },
  gender: { title: "What is your gender?", subtitle: "This helps personalize your coaching profile." },
  height: { title: "How tall are you?", subtitle: "This helps Formie personalize your coaching profile." },
  "why-formie": { title: "Your lift isn’t generic.", subtitle: "So your feedback shouldn’t be either.", eyebrow: "WHY FORMIE?" },
  weight: { title: "What do you weigh?", subtitle: "This helps personalize your coaching profile." },
  experience: { title: "How experienced are you?", subtitle: "Choose the level that best matches your training." },
  "product-demonstration": { title: "Your lift, fully decoded.", subtitle: "Formie finds the moment, explains it, and gives you the next move.", eyebrow: "SEE FORMIE IN ACTION" },
  "primary-goal": { title: "What’s your primary goal?", subtitle: "Formie will tailor your coaching around what matters most." },
  "biggest-frustration": { title: "What frustrates you most?", subtitle: "Choose the one that keeps showing up in your training.", eyebrow: "MAKE IT PERSONAL" },
  "training-frequency": { title: "How often do you train?", subtitle: "Choose your typical number of workouts each week." },
  "custom-milestone": { title: "What goal are you working toward?", subtitle: "Type the milestone you want Formie to keep in mind." },
  "acquisition-source": { title: "Where did you hear about Formie?", subtitle: "This helps us understand what brings athletes to Formie." },
  "long-term-value": { title: "Every set adds context.", subtitle: "See whether the same cue is getting easier, cleaner, and more consistent.", eyebrow: "BUILT FOR THE NEXT WORKOUT" },
  loading: { title: "Building your profile...", subtitle: "Combining your goals, experience, and training context." },
  "create-account": { title: "Save your coaching profile.", subtitle: "Connect an account so your profile and subscription follow you." },
  premium: { title: "Get the answer after every set.", subtitle: "10 complete form analyses each month, with evidence and next-set coaching.", eyebrow: "FORMIE MONTHLY" },
};

const WHEEL_ROW_HEIGHT = 54;
const acquisitionChoices = [
  ["TikTok", "tiktok", "♪", "#61F3E9"],
  ["Instagram", "instagram", "◎", "#F06BB5"],
  ["YouTube", "youtube", "▶", "#FF5A5F"],
  ["App Store search", "app_store_search", "A", "#59A9FF"],
  ["Google search", "google_search", "G", "#77A7FF"],
  ["Friend, trainer, or coach", "friend_trainer_coach", "●●", "#F0B328"],
  ["Other", "other", "…", "#B7B2AC"],
] as const;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const range = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, index) => min + index);

type OnboardingDensity = { compact: boolean; short: boolean };
const DensityContext = createContext<OnboardingDensity>({ compact: false, short: false });

export function getOnboardingDensity(windowHeight: number, topInset: number, bottomInset: number, windowWidth = 390): OnboardingDensity {
  const usableHeight = windowHeight - topInset - bottomInset;
  return { compact: usableHeight < 800 || windowWidth < 370, short: usableHeight < 650 || windowWidth < 340 };
}

function selectHaptic() {
  void Haptics.selectionAsync().catch(() => undefined);
}

function impactHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

function selectThen(action: () => void) {
  selectHaptic();
  action();
}

function impactThen(action: () => void) {
  impactHaptic();
  action();
}

const artworkClose: Partial<Record<ApprovedArtworkStep, string>> = {
  "why-formie": "Specific evidence. One clear correction.",
  "long-term-value": "Less memory. More evidence.",
};

const artworkLayout: Record<ApprovedArtworkStep, { aspectRatio: number; maxWidth: number; maxHeight: number }> = {
  welcome: { aspectRatio: 593 / 700, maxWidth: 500, maxHeight: 560 },
  "product-value": { aspectRatio: 621 / 875, maxWidth: 560, maxHeight: 520 },
  "why-formie": { aspectRatio: 621 / 720, maxWidth: 500, maxHeight: 400 },
  "product-demonstration": { aspectRatio: 2 / 3, maxWidth: 560, maxHeight: 530 },
  "long-term-value": { aspectRatio: 621 / 825, maxWidth: 500, maxHeight: 440 },
  loading: { aspectRatio: 512 / 502, maxWidth: 150, maxHeight: 150 },
};

export function getApprovedArtworkSize(step: ApprovedArtworkStep, windowWidth: number, windowHeight: number) {
  const layout = artworkLayout[step];
  const horizontalPadding = windowWidth < 390 ? 32 : 40;
  const heightFraction = step === "welcome" ? 0.58 : step === "loading" ? 0.2 : step === "product-value" || step === "product-demonstration" ? 0.64 : 0.5;
  const availableWidth = Math.min(layout.maxWidth, Math.max(1, windowWidth - horizontalPadding));
  const availableHeight = Math.min(layout.maxHeight, Math.max(1, windowHeight * heightFraction));
  const width = Math.min(availableWidth, availableHeight * layout.aspectRatio);
  return { width: Math.floor(width), height: Math.floor(width / layout.aspectRatio) };
}

function ApprovedIllustration({ step }: { step: ApprovedArtworkStep }) {
  const { height, width } = useWindowDimensions();
  const size = getApprovedArtworkSize(step, width, height);
  return <View style={[styles.approvedIllustrationCanvas, size]}>
    <Image testID={`approved-illustration-${step}`} accessibilityLabel={`${copy[step].title} illustration`} source={approvedArtwork[step]} contentFit="contain" contentPosition="center" style={styles.approvedIllustration} />
    {step === "product-demonstration" ? <Image testID="product-demonstration-coaching-overlay" accessibilityElementsHidden pointerEvents="none" source={productDemonstrationCoachingOverlay} contentFit="contain" contentPosition="center" style={styles.productDemonstrationCoachingOverlay} /> : null}
  </View>;
}

function NativeArtworkScreen({ step, onNext, onBack, onSignIn }: { step: "welcome" | Exclude<ApprovedArtworkStep, "loading">; onNext: () => void; onBack?: () => void; onSignIn?: () => void }) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const density = getOnboardingDensity(height, insets.top, insets.bottom, width);
  const isWelcome = step === "welcome";
  const closeCopy = step !== "welcome" ? artworkClose[step] : undefined;
  return <DensityContext.Provider value={density}>
    <View testID={isWelcome ? "welcome-brand-screen" : "approved-artwork-screen"} style={[styles.approvedScreen, { paddingTop: Math.max(insets.top, 8), paddingBottom: Math.max(insets.bottom, 10) }]}>
      <StatusBar hidden />
      <ScrollView style={styles.approvedScroll} contentContainerStyle={[styles.approvedScrollContent, density.short && styles.approvedScrollContentShort]} showsVerticalScrollIndicator={false}>
        {isWelcome ? null : <Header step={step} onBack={onBack} compact={density.compact} />}
        {isWelcome ? null : <View style={styles.approvedCopy}>{copy[step].eyebrow ? <Text style={styles.eyebrow}>{copy[step].eyebrow}</Text> : null}<Text style={[styles.approvedTitle, density.short && styles.approvedTitleShort]}>{copy[step].title}</Text><Text style={[styles.approvedSubtitle, density.short && styles.approvedSubtitleShort]}>{copy[step].subtitle}</Text></View>}
        <View style={[styles.approvedIllustrationWrap, isWelcome && styles.welcomeIllustrationWrap, density.short && styles.approvedIllustrationWrapShort]}><ApprovedIllustration step={step} /></View>
        {closeCopy ? <Text style={styles.artworkClose}>{closeCopy}</Text> : null}
      </ScrollView>
      <View style={styles.approvedNativeCta}>
        {isWelcome && onSignIn ? <Pressable testID="onboarding-sign-in" accessibilityRole="button" accessibilityLabel="Already have an account? Sign in" onPress={() => impactThen(onSignIn)} style={({ pressed }) => [styles.signInLink, pressed && styles.pressed]}><Text style={styles.signInLinkText}>Already have an account? <Text style={styles.signInLinkAccent}>Sign in</Text></Text></Pressable> : null}
        {isWelcome ? <NativeGoldButton prominent testID="onboarding-bottom-cta" label="Get Started" onPress={onNext} /> : <GoldButton testID="onboarding-bottom-cta" label="Continue" onPress={onNext} />}
      </View>
    </View>
  </DensityContext.Provider>;
}

function NativeGoldButton({ label, onPress, prominent, testID }: { label: string; onPress: () => void; prominent?: boolean; testID?: string }) {
  const { compact, short } = useContext(DensityContext);
  const baseHeight = short ? onboardingTheme.layout.short.ctaHeight : compact ? onboardingTheme.layout.compact.ctaHeight : onboardingTheme.layout.regular.ctaHeight;
  const height = prominent ? baseHeight + (short ? 4 : 8) : baseHeight;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={() => impactThen(onPress)} style={({ pressed }) => [styles.goldButton, compact && styles.goldButtonCompact, prominent && styles.goldButtonProminent, { height, minHeight: height, opacity: pressed ? 0.8 : 1 }]}><Image accessibilityElementsHidden source={goldGradient} contentFit="fill" style={styles.goldGradientImage} /><View style={[styles.goldButtonGradient, { height, minHeight: height }]}><Text style={[styles.goldButtonText, short && styles.goldButtonTextShort]}>{label}</Text><Text style={[styles.goldArrow, short && styles.goldArrowShort]}>→</Text></View></Pressable>;
}

function GoldButton({ label, onPress, disabled = false, testID }: { label: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  const { compact, short } = useContext(DensityContext);
  const height = short ? onboardingTheme.layout.short.ctaHeight : compact ? onboardingTheme.layout.compact.ctaHeight : onboardingTheme.layout.regular.ctaHeight;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => impactThen(onPress)} style={({ pressed }) => [styles.goldButton, compact && styles.goldButtonCompact, { height, minHeight: height, opacity: disabled ? 0.46 : pressed ? 0.8 : 1 }]}><Image accessibilityElementsHidden source={goldGradient} contentFit="fill" style={styles.goldGradientImage} /><View style={[styles.goldButtonGradient, { height, minHeight: height }]}><Text style={[styles.goldButtonText, short && styles.goldButtonTextShort]}>{label}</Text><Text style={[styles.goldArrow, short && styles.goldArrowShort]}>→</Text></View></Pressable>;
}

function Header({ step, onBack, compact }: { step: OnboardingStep; onBack?: () => void; compact: boolean }) {
  const index = onboardingSteps.indexOf(step) + 1;
  return <><View style={[styles.topBar, compact && styles.topBarCompact]}>{onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => impactThen(onBack)} style={styles.backButton}><Text style={styles.backGlyph}>‹</Text></Pressable> : <View style={styles.backButton} />}<Image source={logo} contentFit="contain" accessibilityLabel="Formie" style={[styles.logo, compact && styles.logoCompact]} /><View style={styles.backButton} /></View><View accessibilityLabel={`Onboarding progress ${index} of ${onboardingSteps.length}`} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: onboardingSteps.length, now: index }} style={styles.progressTrack}><View style={[styles.progressFill, { width: `${(index / onboardingSteps.length) * 100}%` }]} /></View></>;
}

function Scaffold({ step, children, onBack, ctaLabel, ctaDisabled, onCta, footer }: { step: OnboardingStep; children?: React.ReactNode; onBack?: () => void; ctaLabel?: string; ctaDisabled?: boolean; onCta?: () => void; footer?: React.ReactNode }) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const density = getOnboardingDensity(height, insets.top, insets.bottom, width);
  const { compact, short } = density;
  const text = copy[step];
  return <DensityContext.Provider value={density}><View testID="onboarding-scaffold" style={[styles.screen, { paddingTop: Math.max(insets.top, 8), paddingBottom: Math.max(insets.bottom, 12) }]}><StatusBar hidden /><ScrollView testID="onboarding-scroll-body" contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator={false} style={[styles.surface, compact && styles.surfaceCompact]} contentContainerStyle={styles.scrollContent}><View testID="onboarding-native-surface" style={styles.nativeSurface}><Header step={step} onBack={onBack} compact={compact} /><View testID="onboarding-content" style={[styles.content, compact && styles.contentCompact, short && styles.contentShort]}><View style={[styles.copyBlock, compact && styles.copyBlockCompact]}>{text.eyebrow ? <Text style={[styles.eyebrow, short && styles.eyebrowShort]}>{text.eyebrow}</Text> : null}<Text style={[styles.title, compact && styles.titleCompact, short && styles.titleShort]}>{text.title}</Text><Text style={[styles.subtitle, compact && styles.subtitleCompact, short && styles.subtitleShort]}>{text.subtitle}</Text></View><View style={[styles.body, compact && styles.bodyCompact]}>{children}</View></View></View></ScrollView>{ctaLabel && onCta ? <View style={[styles.ctaWrap, compact && styles.ctaWrapCompact, short && styles.ctaWrapShort]}><GoldButton testID="onboarding-bottom-cta" label={ctaLabel} disabled={ctaDisabled} onPress={onCta} /></View> : null}{footer}</View></DensityContext.Provider>;
}

function NumberWheel({ values, selected, suffix = "", onSelect, testID, valueTestID }: { values: number[]; selected: number; suffix?: string; onSelect: (value: number) => void; testID: string; valueTestID?: string }) {
  const { compact, short } = useContext(DensityContext);
  const wheelHeight = short ? 162 : compact ? 216 : 270;
  const wheelPadding = (wheelHeight - WHEEL_ROW_HEIGHT) / 2;
  const selectedIndex = clamp(values.indexOf(selected), 0, values.length - 1);
  const scrollRef = useRef<ScrollView>(null);
  const lastIndexRef = useRef(selectedIndex);
  useEffect(() => { scrollRef.current?.scrollTo({ y: selectedIndex * WHEEL_ROW_HEIGHT, animated: false }); lastIndexRef.current = selectedIndex; }, [selectedIndex]);
  const selectOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = clamp(Math.round(event.nativeEvent.contentOffset.y / WHEEL_ROW_HEIGHT), 0, values.length - 1);
    if (index === lastIndexRef.current) return;
    lastIndexRef.current = index;
    selectThen(() => onSelect(values[index]));
  };
  const choose = (index: number) => { const next = clamp(index, 0, values.length - 1); lastIndexRef.current = next; selectThen(() => onSelect(values[next])); scrollRef.current?.scrollTo({ y: next * WHEEL_ROW_HEIGHT, animated: true }); };
  return <View testID={valueTestID} accessibilityRole="adjustable" accessibilityValue={{ min: values[0], max: values.at(-1), now: selected, text: `${selected}${suffix}` }} accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={(event) => choose(selectedIndex + (event.nativeEvent.actionName === "increment" ? 1 : -1))} style={[styles.wheelFrame, { height: wheelHeight }]}><View pointerEvents="none" style={[styles.wheelSelection, { top: wheelPadding }]} /><ScrollView ref={scrollRef} testID={testID} nestedScrollEnabled scrollEnabled bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false} snapToInterval={WHEEL_ROW_HEIGHT} snapToAlignment="start" disableIntervalMomentum decelerationRate="fast" contentOffset={{ x: 0, y: selectedIndex * WHEEL_ROW_HEIGHT }} contentContainerStyle={[styles.wheelContent, { paddingVertical: wheelPadding }]} onMomentumScrollEnd={selectOffset}>{values.map((value, index) => <Pressable key={value} onPress={() => choose(index)} style={styles.wheelRow}><Text style={[styles.wheelText, value === selected && styles.wheelTextSelected, short && value === selected && styles.wheelTextSelectedShort]}>{value}{suffix}</Text></Pressable>)}</ScrollView></View>;
}

function Segmented({ metric, imperialLabel, metricLabel, onChange }: { metric: boolean; imperialLabel: string; metricLabel: string; onChange: (metric: boolean) => void }) {
  return <View accessibilityRole="radiogroup" style={styles.segmented}><Pressable accessibilityRole="radio" accessibilityState={{ selected: !metric }} onPress={() => selectThen(() => onChange(false))} style={[styles.segment, !metric && styles.segmentSelected]}><Text style={[styles.segmentText, !metric && styles.segmentTextSelected]}>{imperialLabel}</Text></Pressable><Pressable accessibilityRole="radio" accessibilityState={{ selected: metric }} onPress={() => selectThen(() => onChange(true))} style={[styles.segment, metric && styles.segmentSelected]}><Text style={[styles.segmentText, metric && styles.segmentTextSelected]}>{metricLabel}</Text></Pressable></View>;
}

function OptionCard({ title, detail, meta, icon, selected, onPress, compact = false, dense = false }: { title: string; detail?: string; meta?: string; icon?: string; selected: boolean; onPress: () => void; compact?: boolean; dense?: boolean }) {
  return <Pressable accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{ selected }} onPress={() => selectThen(onPress)} style={({ pressed }) => [styles.option, compact && styles.optionCompact, dense && styles.optionDenseRow, selected && styles.optionSelected, pressed && styles.pressed]}>{icon ? <View accessibilityLabel={`${title} choice icon`} style={[styles.goalIcon, selected && styles.goalIconSelected]}><Text style={[styles.goalGlyph, selected && styles.goalGlyphSelected]}>{icon}</Text></View> : null}<View style={styles.optionText}><Text style={[styles.optionTitle, compact && styles.center]}>{title}</Text>{detail ? <Text style={[styles.optionDetail, compact && styles.center]}>{detail}</Text> : null}{meta ? <Text style={styles.optionMeta}>{meta}</Text> : null}</View>{compact ? (selected ? <View style={styles.goalCheck}><Text style={styles.check}>✓</Text></View> : null) : <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <Text style={styles.check}>✓</Text> : null}</View>}</Pressable>;
}

function FrequencySlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const widthRef = useRef(300);
  const valueRef = useRef(value);
  const startValueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);
  const choose = useCallback((next: number) => { const clamped = clamp(next, 1, 7); if (clamped !== valueRef.current) { valueRef.current = clamped; selectThen(() => onChange(clamped)); } }, [onChange]);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { startValueRef.current = valueRef.current; },
    onPanResponderMove: (_, gesture) => choose(Math.round(startValueRef.current + gesture.dx / (widthRef.current / 6))),
  }), [choose]);
  return <View style={styles.frequency}><Text style={styles.frequencyNumber}>{value}</Text><Text style={styles.frequencyLabel}>WORKOUTS PER WEEK</Text><View accessibilityRole="adjustable" accessibilityLabel="Workouts per week" accessibilityValue={{ min: 1, max: 7, now: value, text: `${value} workouts per week` }} accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={(event) => choose(value + (event.nativeEvent.actionName === "increment" ? 1 : -1))} onLayout={(event) => { widthRef.current = event.nativeEvent.layout.width; }} style={styles.frequencyTrack} {...panResponder.panHandlers}>{[1, 2, 3, 4, 5, 6, 7].map((choice) => <Pressable key={choice} accessibilityRole="radio" accessibilityLabel={`${choice} workouts per week`} accessibilityState={{ selected: choice === value }} onPress={() => choose(choice)} style={styles.frequencyChoice}><View style={[styles.dot, choice <= value && styles.dotActive, choice === value && styles.dotSelected]} /><Text style={[styles.tick, choice === value && styles.tickSelected]}>{choice}</Text></Pressable>)}</View><View style={styles.frequencyEnds}><Text style={styles.smallLabel}>ONCE A WEEK</Text><Text style={styles.smallLabel}>DAILY</Text></View></View>;
}

function QuestionControls({ step, answers, onAnswerChange }: ApprovedOnboardingScreenProps) {
  if (step === "age") { const value = answers.ageYears ?? 18; return <View style={styles.wheelPanel}><NumberWheel values={range(13, 100)} selected={value} onSelect={(next) => onAnswerChange("ageYears", next)} testID="onboarding-age-wheel" valueTestID="onboarding-age-value" /><Text style={styles.unit}>years old</Text></View>; }
  if (step === "gender") return <View style={styles.list}><OptionCard dense title="Male" selected={answers.gender === "male"} onPress={() => onAnswerChange("gender", "male")} /><OptionCard dense title="Female" selected={answers.gender === "female"} onPress={() => onAnswerChange("gender", "female")} /><OptionCard dense title="Prefer not to say" selected={answers.gender === "prefer_not_to_say"} onPress={() => onAnswerChange("gender", "prefer_not_to_say")} /></View>;
  if (step === "height") { const metric = answers.measurementSystem === "metric"; const cm = answers.heightCm ?? 177.8; const selected = metric ? Math.round(cm) : Math.round(cm / 2.54); return <View style={styles.measure}><NumberWheel values={metric ? range(120, 230) : range(48, 96)} selected={selected} suffix={metric ? " cm" : " in"} onSelect={(next) => onAnswerChange("heightCm", metric ? heightToCm({ centimeters: next }) : heightToCm({ feet: Math.floor(next / 12), inches: next % 12 }))} testID="onboarding-height-wheel" /><Text style={styles.unit}>{metric ? `${selected} cm` : `${Math.floor(selected / 12)} ft ${selected % 12} in`}</Text><Segmented metric={metric} imperialLabel="ft / in" metricLabel="cm" onChange={(next) => onAnswerChange("measurementSystem", next ? "metric" : "imperial")} /></View>; }
  if (step === "weight") { const metric = answers.measurementSystem === "metric"; const kg = answers.weightKg ?? 74.84; const selected = metric ? Math.round(kg) : Math.round(kg / 0.45359237); return <View style={styles.measure}><NumberWheel values={metric ? range(25, 300) : range(55, 660)} selected={selected} suffix={metric ? " kg" : " lb"} onSelect={(next) => onAnswerChange("weightKg", metric ? weightToKg({ kilograms: next }) : weightToKg({ pounds: next }))} testID="onboarding-weight-wheel" /><Text style={styles.unit}>You can change this later.</Text><Segmented metric={metric} imperialLabel="lb" metricLabel="kg" onChange={(next) => onAnswerChange("measurementSystem", next ? "metric" : "imperial")} /></View>; }
  if (step === "experience") return <View style={styles.list}><OptionCard title="Beginner" detail="I’m learning the fundamentals." meta="0–1 YEAR" selected={answers.experience === "beginner"} onPress={() => onAnswerChange("experience", "beginner")} /><OptionCard title="Intermediate" detail="I train consistently and know the main lifts." meta="1–3 YEARS" selected={answers.experience === "intermediate"} onPress={() => onAnswerChange("experience", "intermediate")} /><OptionCard title="Advanced" detail="I’ve trained seriously for several years." meta="3+ YEARS" selected={answers.experience === "advanced"} onPress={() => onAnswerChange("experience", "advanced")} /></View>;
  if (step === "primary-goal") return <View style={styles.grid}><OptionCard compact icon="◒" title="Build muscle" detail="Add size and control" selected={answers.primaryGoal === "build_muscle"} onPress={() => onAnswerChange("primaryGoal", "build_muscle")} /><OptionCard compact icon="◎" title="Get stronger" detail="Move more weight" selected={answers.primaryGoal === "get_stronger"} onPress={() => onAnswerChange("primaryGoal", "get_stronger")} /><OptionCard compact icon="↘" title="Lose weight" detail="Train consistently" selected={answers.primaryGoal === "lose_weight"} onPress={() => onAnswerChange("primaryGoal", "lose_weight")} /><OptionCard compact icon="⌖" title="Improve technique" detail="Lift confidently" selected={answers.primaryGoal === "improve_technique"} onPress={() => onAnswerChange("primaryGoal", "improve_technique")} /></View>;
  if (step === "biggest-frustration") return <View style={styles.grid}><OptionCard compact icon="—" title="I’ve hit a plateau" detail="Progress has stalled" selected={answers.biggestFrustration === "plateau"} onPress={() => onAnswerChange("biggestFrustration", "plateau")} /><OptionCard compact icon="▰" title="I’m unsure about my form" detail="I second-guess reps" selected={answers.biggestFrustration === "unsure_form"} onPress={() => onAnswerChange("biggestFrustration", "unsure_form")} /><OptionCard compact icon="!" title="Something feels uncomfortable" detail="I need the cause" selected={answers.biggestFrustration === "discomfort"} onPress={() => onAnswerChange("biggestFrustration", "discomfort")} /><OptionCard compact icon="◠" title="I lack confidence" detail="I want direction" selected={answers.biggestFrustration === "lack_confidence"} onPress={() => onAnswerChange("biggestFrustration", "lack_confidence")} /></View>;
  if (step === "training-frequency") return <FrequencySlider value={answers.workoutsPerWeek} onChange={(next) => onAnswerChange("workoutsPerWeek", next)} />;
  if (step === "custom-milestone") return <View style={styles.milestone}><Text style={styles.fieldLabel}>YOUR GOAL</Text><TextInput accessibilityLabel="Your goal" value={answers.customMilestone} maxLength={60} onChangeText={(value) => selectThen(() => onAnswerChange("customMilestone", value))} placeholder="Bench 225 lb" placeholderTextColor="#77736E" style={styles.input} /><Text style={styles.hint}>For example: Bench 225 lb, first pull-up, improve squat depth</Text><Text style={styles.counter}>{answers.customMilestone.length} / 60</Text></View>;
  if (step === "acquisition-source") return <View style={styles.acquisition}><View accessibilityRole="radiogroup" style={styles.acquisitionGrid}>{acquisitionChoices.map(([label, value, icon, iconColor]) => { const selected = answers.acquisitionSource === value; return <Pressable key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => selectThen(() => { onAnswerChange("acquisitionSource", value); if (value !== "other" && answers.acquisitionSourceOther) onAnswerChange("acquisitionSourceOther", ""); })} style={({ pressed }) => [styles.acquisitionOption, selected && styles.acquisitionOptionSelected, pressed && styles.pressed]}><View accessibilityLabel={`${label} source icon`} style={[styles.acquisitionIcon, { borderColor: iconColor }, selected && styles.acquisitionIconSelected]}><Text style={[styles.acquisitionIconGlyph, { color: iconColor }, value === "friend_trainer_coach" && styles.acquisitionPeopleGlyph]}>{icon}</Text></View><Text numberOfLines={2} style={[styles.acquisitionOptionText, selected && styles.acquisitionOptionTextSelected]}>{label}</Text><View style={[styles.acquisitionRadio, selected && styles.radioSelected]}>{selected ? <Text style={styles.check}>✓</Text> : null}</View></Pressable>; })}</View>{answers.acquisitionSource === "other" ? <View style={styles.acquisitionOther}><TextInput accessibilityLabel="Where did you hear about Formie? Other response" value={answers.acquisitionSourceOther} maxLength={80} onChangeText={(value) => onAnswerChange("acquisitionSourceOther", value)} placeholder="Tell us where" placeholderTextColor="#77736E" style={[styles.input, styles.acquisitionInput]} /><Text style={styles.counter}>{answers.acquisitionSourceOther.length} / 80</Text></View> : null}</View>;
  return null;
}

function canContinue(step: OnboardingStep, answers: OnboardingAnswers) {
  if (step === "gender") return answers.gender !== null;
  if (step === "experience") return answers.experience !== null;
  if (step === "primary-goal") return answers.primaryGoal !== null;
  if (step === "biggest-frustration") return answers.biggestFrustration !== null;
  if (step === "custom-milestone") return answers.customMilestone.trim().length > 0;
  if (step === "acquisition-source") return answers.acquisitionSource !== null && (answers.acquisitionSource !== "other" || answers.acquisitionSourceOther.trim().length > 0);
  return true;
}

function QuestionScreen(props: ApprovedOnboardingScreenProps) {
  const next = () => { if (props.step === "age" && props.answers.ageYears === null) props.onAnswerChange("ageYears", 18); if (props.step === "height" && props.answers.heightCm === null) props.onAnswerChange("heightCm", 177.8); if (props.step === "weight" && props.answers.weightKg === null) props.onAnswerChange("weightKg", 74.84); props.onNext(); };
  const hasControls = ["age", "gender", "height", "weight", "experience", "primary-goal", "biggest-frustration", "training-frequency", "custom-milestone", "acquisition-source"].includes(props.step);
  const accommodatesKeyboard = props.step === "custom-milestone" || (props.step === "acquisition-source" && props.answers.acquisitionSource === "other");
  return <KeyboardAvoidingView behavior={accommodatesKeyboard && process.env.EXPO_OS === "ios" ? "padding" : undefined} style={styles.screen}><Scaffold step={props.step} onBack={props.onBack} ctaLabel="Continue" ctaDisabled={!canContinue(props.step, props.answers) || props.busy} onCta={next}>{hasControls ? <><QuestionControls {...props} />{props.error ? <Text accessibilityRole="alert" style={styles.inlineError}>{props.error}</Text> : null}</> : undefined}</Scaffold></KeyboardAvoidingView>;
}

function AccountScreen(props: ApprovedOnboardingScreenProps) {
  const goal = props.answers.customMilestone.trim();
  const personalizedMessage = goal
    ? `Save your account so Formie can keep coaching you toward ${goal}.`
    : "Save your account so Formie can keep your goals, analyses, and personalized coaching together.";
  return <AccountAccessScreen mode="onboarding" personalizedMessage={personalizedMessage} busy={props.busy} busyProvider={props.busyProvider} error={props.error} onBack={props.onBack} onOpenTerms={props.onOpenTerms} onOpenPrivacy={props.onOpenPrivacy} onPrivacyConsentChange={(accepted) => props.onAnswerChange("acceptedPrivacy", accepted)} onMarketingOptInChange={(accepted) => props.onAnswerChange("marketingOptIn", accepted)} onEmail={() => impactThen(props.onEmail)} onOAuth={(provider) => impactThen(() => props.onOAuth(provider))} />;
}

function LoadingScreen({ onComplete }: { onComplete?: () => void }) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const density = getOnboardingDensity(height, insets.top, insets.bottom, width);
  const [stage, setStage] = useState(0);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  useEffect(() => {
    const second = setTimeout(() => setStage(1), 1_300);
    const third = setTimeout(() => setStage(2), 2_600);
    const finish = setTimeout(() => completeRef.current?.(), 4_000);
    return () => { clearTimeout(second); clearTimeout(third); clearTimeout(finish); };
  }, []);
  const steps = ["Personalizing your coaching", "Saving your goals", "Finishing your profile"];
  return <View style={[styles.loadingScreen, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}><StatusBar hidden /><View style={[styles.loadingCenter, density.short && styles.loadingCenterShort]}><ApprovedIllustration step="loading" /><Text style={[styles.loadingTitle, density.short && styles.loadingTitleShort]}>{copy.loading.title}</Text><Text style={styles.loadingSubtitle}>{copy.loading.subtitle}</Text><Text style={styles.loadingStage}>{steps[stage]}</Text><View accessibilityLabel="Profile setup progress" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 3, now: stage + 1 }} style={styles.loadingBar}><View style={[styles.loadingFill, { width: `${((stage + 1) / 3) * 100}%`, backgroundColor: "#F4B531" }]} /></View></View></View>;
}

export function ApprovedOnboardingScreen(props: ApprovedOnboardingScreenProps) {
  if (props.step === "welcome") return <NativeArtworkScreen step="welcome" onNext={props.onNext} onSignIn={props.onSignIn} />;
  if (props.step === "product-value" || props.step === "why-formie" || props.step === "product-demonstration" || props.step === "long-term-value") return <NativeArtworkScreen step={props.step} onNext={props.onNext} onBack={props.onBack} />;
  if (props.step === "loading") return <LoadingScreen onComplete={props.onLoadingComplete} />;
  if (props.step === "create-account") return <AccountScreen {...props} />;
  if (props.step === "premium") return <PremiumScreen price={props.price} purchaseAvailable={props.purchaseAvailable} busy={props.busy} state={props.purchaseState} error={props.error} onRetrySync={props.onRetrySync} onBack={props.onBack} onPurchase={() => impactThen(props.onPurchase)} onPurchasePlan={(plan) => impactThen(() => props.onPurchasePlan ? props.onPurchasePlan(plan) : props.onPurchase())} />;
  return <QuestionScreen {...props} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#050505" },
  welcomeScreen: { flex: 1, backgroundColor: "#030303", paddingHorizontal: 20 },
  welcomeScroll: { flexGrow: 1, minHeight: 560, alignItems: "center", justifyContent: "center", paddingVertical: 34 },
  welcomeWordmark: { color: "#F7F6F4", fontSize: 45, lineHeight: 54, fontWeight: "300", letterSpacing: 11, marginLeft: 11 },
  welcomeTagline: { color: "#9E9993", fontSize: 17, lineHeight: 24, marginTop: 10 },
  welcomeCta: { width: "100%", maxWidth: 520, alignSelf: "center", paddingBottom: 4 },
  signInLink: { width: "100%", minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  signInLinkText: { color: "#AAA6A2", fontSize: 15, lineHeight: 20, fontWeight: "600" },
  signInLinkAccent: { color: "#E5AD32", fontWeight: "800" },
  approvedScreen: { flex: 1, overflow: "hidden", backgroundColor: "#050505", alignItems: "center", justifyContent: "center" },
  approvedNativeHeader: { width: "100%", maxWidth: 620, paddingHorizontal: 20 },
  approvedNativeCta: { width: "100%", maxWidth: 620, paddingHorizontal: 20, paddingTop: 10 },
  approvedScroll: { flex: 1, width: "100%", maxWidth: 620 },
  approvedScrollContent: { flexGrow: 1, paddingBottom: 8 },
  approvedScrollContentShort: {},
  approvedCopy: { paddingTop: 22, paddingHorizontal: 22, gap: 7 },
  approvedTitle: { color: "#F7F6F4", fontSize: 34, lineHeight: 39, fontWeight: "800", letterSpacing: -1 },
  approvedTitleShort: { fontSize: 27, lineHeight: 31 },
  approvedSubtitle: { color: "#AAA6A2", fontSize: 15, lineHeight: 21 },
  approvedSubtitleShort: { fontSize: 12.5, lineHeight: 17 },
  approvedIllustrationWrap: { flex: 1, minHeight: 0, width: "100%", alignItems: "center", justifyContent: "center", marginTop: 10 },
  approvedIllustrationWrapShort: { marginTop: 4 },
  welcomeIllustrationWrap: { marginTop: 0, paddingVertical: 6 },
  approvedIllustrationCanvas: { position: "relative", overflow: "visible" },
  approvedIllustration: { width: "100%", height: "100%" },
  productDemonstrationCoachingOverlay: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%", opacity: 0.94, transform: [{ scale: 1.07 }] },
  artworkClose: { color: "#D7D3CE", fontSize: 13, lineHeight: 18, textAlign: "center", fontWeight: "600", paddingVertical: 4 },
  loadingNativeStatus: { width: "100%", maxWidth: 420, alignItems: "center", gap: 10, paddingHorizontal: 24 },
  surface: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", paddingHorizontal: 22 },
  nativeSurface: { flexGrow: 1 },
  surfaceCompact: { paddingHorizontal: 18 },
  scrollContent: { flexGrow: 1 },
  topBar: { height: 68, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topBarCompact: { height: 56 },
  backButton: { width: 48, height: 48, alignItems: "flex-start", justifyContent: "center" },
  backGlyph: { color: "#F6F5F3", fontSize: 42, lineHeight: 44, fontWeight: "200" },
  logo: { width: 52, height: 52 }, logoCompact: { width: 44, height: 44 },
  progressTrack: { height: 2, backgroundColor: "#2A2927", borderRadius: 1, overflow: "hidden" }, progressFill: { height: 2, backgroundColor: "#F4B531" },
  content: { flex: 1, paddingTop: 24, gap: 18 }, contentCompact: { paddingTop: 14, gap: 10 },
  contentShort: { paddingTop: 8, gap: 6 },
  copyBlock: { gap: 9 }, copyBlockCompact: { gap: 5 },
  copyBlockArtwork: { paddingHorizontal: 22 },
  eyebrow: { color: "#F4B531", fontSize: 11, letterSpacing: 2.4, fontWeight: "800" },
  eyebrowShort: { fontSize: 9, letterSpacing: 1.8 },
  title: { color: "#F7F6F4", fontSize: 36, lineHeight: 41, fontWeight: "800", letterSpacing: -1.1 }, titleCompact: { fontSize: 29, lineHeight: 33 },
  titleShort: { fontSize: 25, lineHeight: 28 },
  subtitle: { color: "#AAA6A2", fontSize: 16, lineHeight: 23 }, subtitleCompact: { fontSize: 13.5, lineHeight: 18 },
  subtitleShort: { fontSize: 12, lineHeight: 15 },
  body: { flex: 1, justifyContent: "center", minHeight: 0 },
  artworkBody: { alignItems: "center", justifyContent: "flex-start" },
  bodyCompact: { justifyContent: "center" },
  ctaWrap: { width: "100%", maxWidth: 520, alignSelf: "center", paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12 }, ctaWrapCompact: { paddingTop: 5, paddingBottom: 8 },
  ctaWrapShort: { paddingHorizontal: 18, paddingTop: 3, paddingBottom: 6 },
  goldButton: { width: "100%", minHeight: 62, borderRadius: 14, borderCurve: "continuous", overflow: "hidden" }, goldButtonProminent: { borderRadius: 16 },
  goldGradientImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  goldButtonGradient: { flex: 1, minHeight: 62, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goldButtonCompact: { minHeight: 52 }, goldButtonShort: { minHeight: 46, paddingHorizontal: 18 },
  goldButtonText: { color: "#070707", fontSize: 19, fontWeight: "800" }, goldArrow: { color: "#070707", fontSize: 31, lineHeight: 34 },
  goldButtonTextShort: { fontSize: 16 }, goldArrowShort: { fontSize: 25, lineHeight: 28 },
  hero: { flex: 1, width: "100%", maxHeight: 420, minHeight: 220, borderRadius: 22, borderCurve: "continuous", opacity: 0.88 }, heroCompact: { minHeight: 150, maxHeight: 270 },
  wideHero: { width: "100%", height: "80%", maxHeight: 330, borderRadius: 22, borderCurve: "continuous", opacity: 0.9 }, wideHeroCompact: { maxHeight: 230 },
  insights: { gap: 12, transform: [{ rotate: "-2deg" }] }, insight: { padding: 18, borderRadius: 12, borderWidth: 1, borderColor: "#3B3936", backgroundColor: "#0B0B0B" }, insightActive: { borderColor: "#F4B531", backgroundColor: "#171106", transform: [{ rotate: "3deg" }] }, insightText: { color: "#ECEAE7", fontSize: 20, fontWeight: "600" },
  demoStack: { gap: 12 }, demoCard: { padding: 19, gap: 8, borderRadius: 18, borderWidth: 1, borderColor: "#47433F", backgroundColor: "#0C0C0C" }, cardLabel: { color: "#F4B531", fontSize: 10, letterSpacing: 1.8, fontWeight: "800" }, demoTitle: { color: "#F7F6F4", fontSize: 22, fontWeight: "800" }, demoBody: { color: "#B0ACA7", fontSize: 15, lineHeight: 21 }, cueCard: { padding: 17, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: "#A77A21", backgroundColor: "#151005" }, cueText: { color: "#F5CF70", fontSize: 17, lineHeight: 22, fontWeight: "700" },
  wheelPanel: { alignItems: "stretch", gap: 8 }, measure: { flex: 1, justifyContent: "center", gap: 10 }, wheelFrame: { height: 270, overflow: "hidden" }, wheelSelection: { position: "absolute", zIndex: 2, left: 12, right: 12, top: 108, height: WHEEL_ROW_HEIGHT, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#D89B18" }, wheelContent: { paddingVertical: 108 }, wheelRow: { height: WHEEL_ROW_HEIGHT, alignItems: "center", justifyContent: "center" }, wheelText: { color: "#6F6B67", fontSize: 24, fontWeight: "300", fontVariant: ["tabular-nums"] }, wheelTextSelected: { color: "#F6F5F3", fontSize: 36, fontWeight: "800" }, wheelTextSelectedShort: { fontSize: 31 }, unit: { color: "#AAA6A2", fontSize: 13, textAlign: "center" },
  segmented: { alignSelf: "center", width: "72%", height: 40, flexDirection: "row", borderRadius: 9, overflow: "hidden", backgroundColor: "#141414" }, segment: { flex: 1, alignItems: "center", justifyContent: "center" }, segmentSelected: { backgroundColor: "#F8B531" }, segmentText: { color: "#AAA6A2", fontSize: 14, fontWeight: "700" }, segmentTextSelected: { color: "#070707" },
  list: { gap: 12 }, grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12, paddingBottom: 8 }, option: { minHeight: 112, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, borderCurve: "continuous", borderWidth: 1, borderColor: "#45423F", backgroundColor: "#090909" }, optionDenseRow: { minHeight: 76, paddingVertical: 10 }, optionCompact: { width: "48%", minHeight: 124, paddingHorizontal: 10, paddingVertical: 12, flexDirection: "column", justifyContent: "center", gap: 8 }, optionSelected: { borderColor: "#F0B328", backgroundColor: "#171106" }, pressed: { opacity: 0.75 }, optionText: { flex: 1, gap: 5 }, optionTitle: { color: "#F6F5F3", fontSize: 17, fontWeight: "700" }, optionDetail: { color: "#9B9792", fontSize: 12.5, lineHeight: 17 }, optionMeta: { color: "#F0B328", fontSize: 10, lineHeight: 14, letterSpacing: 1.8, fontWeight: "800", marginTop: 4 }, center: { textAlign: "center" }, radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: "#797673", alignItems: "center", justifyContent: "center" }, radioSelected: { borderColor: "#F0B328", backgroundColor: "#F0B328" }, check: { color: "#060606", fontSize: 14, fontWeight: "900" },
  goalIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#77736E" }, goalIconSelected: { borderColor: "#F0B328", backgroundColor: "#241A06" }, goalGlyph: { color: "#B4B0AB", fontSize: 31, lineHeight: 35 }, goalGlyphSelected: { color: "#F0B328" }, goalCheck: { position: "absolute", right: 8, top: 8, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F0B328" },
  optionDense: { minHeight: 58, paddingVertical: 8 }, optionShort: { minHeight: 48, paddingVertical: 5 }, optionTitleShort: { fontSize: 14 }, optionDetailShort: { fontSize: 10, lineHeight: 12 }, radioShort: { width: 20, height: 20 },
  frequency: { alignItems: "center", gap: 12 }, frequencyNumber: { color: "#F7F6F4", fontSize: 58, lineHeight: 62, fontWeight: "800", fontVariant: ["tabular-nums"] }, frequencyLabel: { color: "#AAA6A2", fontSize: 10, letterSpacing: 2, fontWeight: "800" }, frequencyTrack: { width: "100%", height: 65, flexDirection: "row", alignItems: "flex-start", borderTopWidth: 2, borderTopColor: "#393633", marginTop: 18 }, frequencyChoice: { flex: 1, height: 64, alignItems: "center", gap: 9, top: -5 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#55514E" }, dotActive: { backgroundColor: "#F0B328" }, dotSelected: { width: 16, height: 16, borderRadius: 8, top: -4 }, tick: { color: "#77736E", fontSize: 12 }, tickSelected: { color: "#F0B328", fontWeight: "800", top: -4 }, frequencyEnds: { width: "100%", flexDirection: "row", justifyContent: "space-between" }, smallLabel: { color: "#77736E", fontSize: 9, letterSpacing: 1 },
  milestone: { gap: 10 }, fieldLabel: { color: "#F0B328", fontSize: 10, letterSpacing: 2, fontWeight: "800" }, input: { minHeight: 58, borderRadius: 12, borderWidth: 1, borderColor: "#514E49", paddingHorizontal: 15, color: "#F6F5F3", backgroundColor: "#090909", fontSize: 18 }, hint: { color: "#8E8A86", fontSize: 12, lineHeight: 17 }, counter: { color: "#8E8A86", fontSize: 11, textAlign: "right" },
  acquisition: { flex: 1, minHeight: 0, justifyContent: "center", gap: 9 },
  acquisitionGrid: { width: "100%", gap: 6 },
  acquisitionOption: { width: "100%", minHeight: 62, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 13, borderCurve: "continuous", borderWidth: 1, borderColor: "#45423F", backgroundColor: "#090909", flexDirection: "row", alignItems: "center", gap: 12 },
  acquisitionOptionSelected: { borderColor: "#F0B328", backgroundColor: "#171106" },
  acquisitionIcon: { width: 42, height: 42, borderRadius: 12, borderWidth: 1.25, alignItems: "center", justifyContent: "center", backgroundColor: "#111110" },
  acquisitionIconSelected: { backgroundColor: "#201706" },
  acquisitionIconGlyph: { fontSize: 22, lineHeight: 26, fontWeight: "800" },
  acquisitionPeopleGlyph: { fontSize: 12, letterSpacing: -3, paddingRight: 3 },
  acquisitionOptionText: { flex: 1, color: "#E4E0DB", fontSize: 15.5, lineHeight: 19, fontWeight: "700" },
  acquisitionOptionTextSelected: { color: "#F7F2E8" },
  acquisitionRadio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.25, borderColor: "#797673", alignItems: "center", justifyContent: "center" },
  acquisitionOther: { gap: 3 },
  acquisitionInput: { minHeight: 46, fontSize: 15 },
  inlineError: { color: "#FF7C7C", fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 10 },
  account: { gap: 14, paddingBottom: 8 }, provider: { minHeight: 70, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 }, providerDisabled: { opacity: 0.48 }, apple: { backgroundColor: "#F7F7F7" }, google: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DADCE0" }, providerIcon: { width: 32, height: 32 }, appleText: { color: "#080808", fontSize: 18, fontWeight: "700" }, googleText: { color: "#202124", fontSize: 18, fontWeight: "700" }, busy: { minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, muted: { color: "#AAA6A2", fontSize: 13, textAlign: "center" }, error: { color: "#FF7C7C", fontSize: 12.5, lineHeight: 18, textAlign: "center" }, legal: { color: "#8F8B87", fontSize: 11.5, lineHeight: 17, textAlign: "center" }, link: { color: "#F0B328" }, restore: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  consents: { gap: 10, marginTop: 2 }, consentRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 }, checkbox: { width: 30, height: 30, borderRadius: 8, borderWidth: 1.5, borderColor: "#77736E", alignItems: "center", justifyContent: "center" }, checkboxChecked: { borderColor: "#F0B328", backgroundColor: "#F0B328" }, checkboxGlyph: { color: "#080808", fontSize: 19, fontWeight: "900" }, consentText: { flex: 1, color: "#D7D3CE", fontSize: 14, lineHeight: 19 },
  accountCompact: { gap: 8 }, providerShort: { minHeight: 44 }, providerIconShort: { width: 18, height: 18 }, restoreShort: { minHeight: 28 },
  premiumCard: { gap: 12, padding: 20, borderRadius: 22, borderCurve: "continuous", borderWidth: 1.5, borderColor: "#D79A18", backgroundColor: "#0B0B0B" }, premiumEyebrow: { color: "#F4B531", fontSize: 12, letterSpacing: 2.3, fontWeight: "800" }, priceRow: { flexDirection: "row", alignItems: "flex-end" }, price: { color: "#F7F6F4", fontSize: 50, lineHeight: 54, fontWeight: "800", fontVariant: ["tabular-nums"] }, perMonth: { color: "#D3D0CC", fontSize: 16, paddingBottom: 7 }, analysisLimit: { color: "#A7A29C", fontSize: 15, paddingBottom: 4 }, benefit: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: "#35322E", paddingTop: 10 }, benefitCheck: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F0B328", alignItems: "center", justifyContent: "center" }, benefitText: { color: "#E8E5E1", fontSize: 15 }, cancel: { color: "#AAA6A2", fontSize: 12, lineHeight: 17, textAlign: "center" }, restorePurchase: { minHeight: 42, alignItems: "center", justifyContent: "center" },
  premiumCardCompact: { gap: 8, padding: 14 }, premiumCardShort: { gap: 5, padding: 11 }, priceShort: { fontSize: 36, lineHeight: 39 }, benefitShort: { minHeight: 27, paddingTop: 5, gap: 8 }, benefitCheckShort: { width: 19, height: 19 }, restorePurchaseShort: { minHeight: 25 },
  subscriptionFooter: { flexDirection: "row", justifyContent: "center", gap: 28 }, logoutLink: { color: "#FF7C7C", fontSize: 13, textAlign: "center" },
  loadingScreen: { flex: 1, backgroundColor: "#020202", paddingHorizontal: 28 },
  loadingCenter: { flex: 1, width: "100%", maxWidth: 420, alignSelf: "center", alignItems: "center", justifyContent: "center", gap: 16 },
  loadingCenterShort: { gap: 10 },
  loadingLogoWrap: { width: 142, height: 142, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  loadingLogo: { width: 102, height: 102 },
  loadingRing: { position: "absolute", width: 132, height: 132, borderRadius: 66, borderWidth: 4, borderColor: "#F4B531", transform: [{ rotate: "32deg" }] },
  loadingRingGap: { position: "absolute", top: -7, left: 44, width: 36, height: 12, backgroundColor: "#020202" },
  loadingTitle: { color: "#F7F6F4", fontSize: 28, lineHeight: 34, fontWeight: "800", textAlign: "center", letterSpacing: -0.6 },
  loadingTitleShort: { fontSize: 23, lineHeight: 28 },
  loadingSubtitle: { maxWidth: 330, color: "#AAA6A2", fontSize: 14, lineHeight: 20, textAlign: "center" },
  loadingStage: { color: "#A6A19B", fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  loadingBar: { width: "82%", maxWidth: 320, height: 6, borderRadius: 3, backgroundColor: "#282624", overflow: "hidden", marginTop: 4 }, loadingFill: { height: 6, borderRadius: 3 },
});
