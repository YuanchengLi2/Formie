import type { OnboardingAnswers } from "./types";

type AcquisitionReportingClient = {
  rpc: (name: "record_onboarding_acquisition", args: {
    p_source: NonNullable<OnboardingAnswers["acquisitionSource"]>;
    p_other_detail: string;
    p_platform: "ios" | "android" | "web" | "unknown";
    p_onboarding_version: "approved-v1";
  }) => Promise<{ data: string | null; error: { message?: string } | null }>;
};

function reportingPlatform(platform: string): "ios" | "android" | "web" | "unknown" {
  return platform === "ios" || platform === "android" || platform === "web" ? platform : "unknown";
}

export async function recordOnboardingAcquisition(
  client: AcquisitionReportingClient,
  answers: OnboardingAnswers,
  platform: string,
): Promise<string> {
  if (!answers.acquisitionSource) throw new Error("An acquisition source is required before profile sync.");
  const otherDetail = answers.acquisitionSource === "other" ? answers.acquisitionSourceOther.trim() : "";
  if (answers.acquisitionSource === "other" && !otherDetail) throw new Error("An Other acquisition source is required before profile sync.");
  const result = await client.rpc("record_onboarding_acquisition", {
    p_source: answers.acquisitionSource,
    p_other_detail: otherDetail,
    p_platform: reportingPlatform(platform),
    p_onboarding_version: "approved-v1",
  });
  if (result.error || !result.data) throw new Error(result.error?.message ?? "The acquisition response could not be saved.");
  return result.data;
}

export type { AcquisitionReportingClient };
