export const REVENUECAT_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "formie_pro";
export const REVENUECAT_OFFERING_ID = process.env.EXPO_PUBLIC_REVENUECAT_OFFERING_ID ?? "default";
export const REVENUECAT_PRODUCT_ID = process.env.EXPO_PUBLIC_REVENUECAT_PRODUCT_ID ?? "formie_monthly";
export const REVENUECAT_MONTHLY_PRODUCT_ID = process.env.EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID ?? REVENUECAT_PRODUCT_ID;
export const REVENUECAT_YEARLY_PRODUCT_ID = process.env.EXPO_PUBLIC_REVENUECAT_YEARLY_PRODUCT_ID ?? "formie_yearly";
export const REVENUECAT_IOS_PUBLIC_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_PUBLIC_KEY ?? "";
export const REVENUECAT_ANDROID_PUBLIC_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_PUBLIC_KEY ?? "";
export const REVENUECAT_WEB_PUBLIC_KEY = process.env.EXPO_PUBLIC_REVENUECAT_WEB_PUBLIC_KEY ?? REVENUECAT_IOS_PUBLIC_KEY;
export const REVENUECAT_LAUNCH_VERSION = "certainty-v1";

export function assertRevenueCatPublicKey(apiKey: string, options: { platform: "ios" | "android" | "web"; releaseBuild: boolean }): void {
  if (options.releaseBuild && apiKey.startsWith("test_")) {
    throw new Error("RevenueCat Test Store keys cannot be used in a release build. Configure the real App Store or Google Play public key.");
  }
  if (options.platform !== "web" && apiKey.startsWith("test_")) {
    throw new Error("RevenueCat Test Store keys cannot be used for native builds. Configure the platform store public key so development purchases use the store sandbox.");
  }
}
