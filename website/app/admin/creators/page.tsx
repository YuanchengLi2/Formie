import { redirect } from "next/navigation";
import { BusinessDashboardShell } from "@/components/admin/business-dashboard-shell";
import { CreatorManagement } from "@/components/admin/creator-management";
import { loadBusinessDashboard } from "@/lib/admin/load-business-dashboard";
import { AdminAccessError } from "@/lib/admin/load-dashboard";
import { parseDashboardRange, type DashboardSearchParams } from "@/lib/reporting/filters";
import { createServiceClient } from "@/lib/admin/supabase-runtime";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<DashboardSearchParams>}){let data;try{const range=parseDashboardRange(await searchParams);data=await loadBusinessDashboard("creators",range.window,range.start,range.end)}catch(error){if(error instanceof AdminAccessError)redirect("/admin/login");throw error}const {data:settings,error}=await createServiceClient().from("referral_program_settings").select("issuance_enabled,rewards_enabled,updated_at").eq("singleton",true).single();if(error)throw error;return <BusinessDashboardShell dashboard={data.dashboard} adminEmail={data.adminEmail}><CreatorManagement dashboard={data.dashboard} settings={{issuanceEnabled:settings.issuance_enabled,rewardsEnabled:settings.rewards_enabled,updatedAt:settings.updated_at}}/></BusinessDashboardShell>}
