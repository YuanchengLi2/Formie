import {notFound,redirect} from "next/navigation";
import {BusinessDashboardShell} from "@/components/admin/business-dashboard-shell";
import {CreatorDetail} from "@/components/admin/creator-detail";
import {loadBusinessDashboard,loadFounderCreatorDetail} from "@/lib/admin/load-business-dashboard";
import {AdminAccessError} from "@/lib/admin/load-dashboard";
export const dynamic="force-dynamic";
export default async function Page({params,searchParams}:{params:Promise<{creatorId:string}>;searchParams:Promise<{page?:string}>}){let data;let creator;const creatorId=(await params).creatorId;const page=Math.max(1,Number.parseInt((await searchParams).page??"1",10)||1);try{[data,creator]=await Promise.all([loadBusinessDashboard("creators","all"),loadFounderCreatorDetail(creatorId,page)])}catch(error){if(error instanceof AdminAccessError)redirect("/admin/login");throw error}if(!creator)notFound();return <BusinessDashboardShell dashboard={data.dashboard} adminEmail={data.adminEmail}><CreatorDetail creator={creator} page={page}/></BusinessDashboardShell>}
