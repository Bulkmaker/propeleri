import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isAdminRole } from "@/lib/auth/roles";
import AdminShell from "./AdminShell";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("app_role, team_role")
    .eq("id", user.id)
    .single();

  // If profile not found or error occurred, redirect to home
  if (!profile || error) {
    redirect("/");
  }

  // Check admin role
  if (!isAdminRole(profile)) {
    redirect("/");
  }

  // Now profile is guaranteed to be not null
  return <AdminShell isAdmin={profile.app_role === "admin"}>{children}</AdminShell>;
}
