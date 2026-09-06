import { isAdminEmail } from "./access";
import { createCookieClient } from "./supabase-runtime";
import { AdminAccessError } from "./load-dashboard";
export async function requireAdmin(){const client=await createCookieClient();const {data,error}=await client.auth.getUser();const email=error?null:data.user?.email??null;if(!data.user||!isAdminEmail(email,process.env.FORMIE_ADMIN_EMAIL))throw new AdminAccessError();return {user:data.user,email:email!}}
