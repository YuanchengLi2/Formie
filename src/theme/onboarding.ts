export const onboardingTheme = {
  colors: {
    background: "#050505",
    surface: "#111110",
    surfaceRaised: "#171613",
    border: "#38352E",
    gold: "#E5AD32",
    goldMuted: "#C99A36",
    text: "#F5F4F0",
    textMuted: "#8E8A86",
    positive: "#35CF87",
    positiveSurface: "#14271F",
    cueSurface: "#2B2315",
  },
  radius: { small: 10, medium: 16, large: 24 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  primaryControlHeight: 56,
  minimumTouchTarget: 44,
  layout: {
    regular: { ctaHeight: 56, labelSize: 17, arrowSize: 27, gap: 18, artworkMaxHeight: 430 },
    compact: { ctaHeight: 52, labelSize: 16, arrowSize: 25, gap: 10, artworkMaxHeight: 340 },
    short: { ctaHeight: 48, labelSize: 15, arrowSize: 23, gap: 6, artworkMaxHeight: 260 },
  },
} as const;
