import { CreatorDashboard, CreatorShell } from "@/components/creators/creator-dashboard";
import { loadCreatorDashboard } from "@/lib/creators/load-dashboard";
import { redirectCreatorLogin } from "@/lib/creators/access";
import { parseDashboardRange, type DashboardSearchParams } from "@/lib/reporting/filters";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  const range = parseDashboardRange(await searchParams);
  let data;
  try { data = await loadCreatorDashboard(range.window, 1, 50, range.start, range.end); }
  catch (error) { redirectCreatorLogin(error); }
  return <CreatorShell data={data} active="overview"><CreatorDashboard data={data}/></CreatorShell>;
}
