import { parseDashboardSnapshot } from "./dashboard-data";
const m = (value: number | null, quality: "exact" | "estimated" | "incomplete" | "unavailable" = value === null ? "unavailable" : "exact", numerator: number | null = null, denominator: number | null = null) => ({ value, quality, numerator, denominator, observedSince: "2026-08-29T00:00:00Z", detail: "Fixture metric", scope: "filtered" });
export const rawDashboardSnapshot = {
  generatedAt: "2026-08-29T12:00:00Z", filters: { window: "30d", exerciseId: null, exerciseLabel: null, exerciseOptions: [{ id: 42, label: "Back Squat" }] },
  headline: { newSignups:m(42),firstRecordingDeliveryRate:m(75,"incomplete",15,20),medianSignupToFirstAnalysisMs:m(120000),analysesPerActiveUser:m(2.4),sameSessionSecondAnalysisRate:m(38.5,"incomplete",5,13),sevenDayRepeatRate:m(32,"exact",8,25),thirtyDayRetentionRate:m(null,"incomplete",0,0),helpfulRate:m(80,"exact",8,10),freeToPaidConversionRate:m(20,"exact",2,10),aiCostPerDeliveredAnalysis:m(.08,"incomplete",9,10),estimatedMrr:m(29.97,"estimated",3,3)},
  cohorts:{northStar:m(32,"exact",8,25),habit14d:m(20,"exact",4,20),retention30d:m(null,"incomplete",0,0)}, activity:{dau:m(8),wau:m(23),mau:m(31)},
  funnel:[{key:"signup",label:"Signed up",users:m(42),conversion:m(100),medianTransitionMs:m(null)},{key:"first_analysis",label:"First analysis",users:m(20),conversion:m(47.6),medianTransitionMs:m(120000)}],
  breakdowns:{helpfulness:[{key:"42",label:"Back Squat",metrics:{helpful_rate:m(80,"exact",8,10)}}],loop:[]},
  operations:{reliability:{technical_failure_rate:m(3,"exact",3,100)},billing:{active_paid:m(3)},economics:{estimated_contribution_margin:m(null,"incomplete")}},
  recentUsers:[], recentAnalyses:[],
};
export const dashboardSnapshot = parseDashboardSnapshot(rawDashboardSnapshot);
