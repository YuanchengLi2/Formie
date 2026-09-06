"use server";import {redirect} from "next/navigation";import {requireCreator} from "@/lib/creators/access";
export async function updatePassword(formData:FormData){const {client}=await requireCreator();const password=String(formData.get("password")??"");if(password.length<12)throw new Error("Password must be at least 12 characters.");const {error}=await client.auth.updateUser({password});if(error)throw error;redirect("/creators/account")}
export async function logoutCreator(){const {client}=await requireCreator();await client.auth.signOut();redirect("/creators/login")}
