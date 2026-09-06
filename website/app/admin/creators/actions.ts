"use server";
import { createServiceClient } from "@/lib/admin/supabase-runtime";
import { requireAdmin } from "@/lib/admin/require-admin";

export type CreatorActionState={ok:boolean;message:string;invitationUrl?:string;creatorId?:string};
const codeBase=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,20);
export async function createCreator(_previous:CreatorActionState,formData:FormData):Promise<CreatorActionState>{
  try{const {user}=await requireAdmin();const displayName=String(formData.get("displayName")??"").trim();const email=String(formData.get("email")??"").trim().toLowerCase();const rate=Math.round(Number(formData.get("ratePercent"))*100);if(displayName.length<2||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||!Number.isInteger(rate)||rate<0||rate>2000)return {ok:false,message:"Enter a valid creator, email, and rate from 0% to 20%."};const admin=createServiceClient();const redirectTo=`${process.env.NEXT_PUBLIC_SITE_URL??"https://useformie.com"}/creators/auth?next=/creators/account`;const {data:link,error:linkError}=await admin.auth.admin.generateLink({type:"invite",email,options:{redirectTo}});if(linkError||!link.user)throw linkError??new Error("Invitation user was not created");const slug=`${codeBase(displayName)||"creator"}-${crypto.randomUUID().replace(/-/g,"").slice(0,6)}`;const {data:creatorId,error}=await admin.rpc("provision_creator",{p_user_id:link.user.id,p_display_name:displayName,p_slug:slug,p_rate_basis_points:rate,p_actor_user_id:user.id});if(error){await admin.auth.admin.deleteUser(link.user.id).catch(()=>undefined);throw error}return {ok:true,message:"Creator provisioned. Share the creator code and this one-time portal invitation through your normal channel.",invitationUrl:link.properties.action_link,creatorId:String(creatorId)};
  }catch(error){return {ok:false,message:error instanceof Error?error.message:"Creator could not be provisioned."}}
}
export async function updateCreator(_previous:CreatorActionState,formData:FormData):Promise<CreatorActionState>{
  try{
    const {user}=await requireAdmin();
    const creatorId=String(formData.get("creatorId")??"");
    const intent=String(formData.get("intent")??"");
    const admin=createServiceClient();
    if(intent==="program_settings"){
      const issuanceEnabled=formData.get("issuanceEnabled")==="on";
      const rewardsEnabled=formData.get("rewardsEnabled")==="on";
      const {error}=await admin.rpc("set_referral_program_settings",{p_issuance_enabled:issuanceEnabled,p_rewards_enabled:rewardsEnabled,p_actor_user_id:user.id});
      if(error)throw error;
      return {ok:true,message:`Referral settings updated: issuance ${issuanceEnabled?"enabled":"disabled"}; rewards for newly attributed accounts ${rewardsEnabled?"enabled":"disabled"}.`};
    }
    if(intent==="pause"||intent==="resume"){
      const {error}=await admin.rpc("set_creator_link_state",{p_creator_id:creatorId,p_status:intent==="pause"?"paused":"active",p_actor_user_id:user.id});
      if(error)throw error;
      return {ok:true,message:`Creator code ${intent==="pause"?"paused":"resumed"}.`};
    }
    if(intent==="rate"){
      const rate=Math.round(Number(formData.get("ratePercent"))*100);
      if(!Number.isInteger(rate)||rate<0||rate>2000)return {ok:false,message:"Rate must be between 0% and 20%."};
      const {error}=await admin.rpc("set_creator_future_rate",{p_creator_id:creatorId,p_rate_basis_points:rate,p_actor_user_id:user.id});
      if(error)throw error;
      return {ok:true,message:"Future referral rate updated. Existing accounts keep their locked rate."};
    }
    if(intent==="membership"){
      const memberUserId=String(formData.get("memberUserId")??"");
      const membershipStatus=String(formData.get("membershipStatus")??"");
      if(!memberUserId||!['active','revoked'].includes(membershipStatus))return {ok:false,message:"Choose a valid portal membership action."};
      const {error}=await admin.rpc("set_creator_membership_state",{p_creator_id:creatorId,p_user_id:memberUserId,p_status:membershipStatus,p_actor_user_id:user.id});
      if(error)throw error;
      return {ok:true,message:membershipStatus==="revoked"?"Creator portal access revoked. Business records and earnings were retained.":"Creator portal access restored."};
    }
    if(intent==="prepare_payout"){
      const currency=String(formData.get("currency")??"").toUpperCase();
      if(!/^[A-Z]{3}$/.test(currency))return {ok:false,message:"Choose a valid payout currency."};
      const {data,error}=await admin.rpc("prepare_creator_payout",{p_creator_id:creatorId,p_currency:currency,p_actor:user.id});
      if(error)throw error;
      return {ok:true,message:`Payout ${String(data)} prepared. Preparation does not mark it paid.`};
    }
    if(intent==="mark_paid"){
      const payoutId=String(formData.get("payoutId")??"");
      const reference=String(formData.get("externalReference")??"").trim();
      const paidDate=String(formData.get("paidDate")??"");
      const paidAt=new Date(`${paidDate}T12:00:00.000Z`);
      if(!payoutId||reference.length<2||!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)||Number.isNaN(paidAt.valueOf())||paidAt.getTime()>Date.now())return {ok:false,message:"Enter the actual payment date and external payment reference."};
      const {error}=await admin.rpc("mark_creator_payout_paid",{p_payout_id:payoutId,p_paid_at:paidAt.toISOString(),p_external_reference:reference,p_actor:user.id});
      if(error)throw error;
      return {ok:true,message:"External payout recorded as paid."};
    }
    return {ok:false,message:"Unknown creator action."};
  }catch(error){return {ok:false,message:error instanceof Error?error.message:"Creator update failed."};}
}
