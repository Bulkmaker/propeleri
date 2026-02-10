import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // Verify the caller is an admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("app_role, team_role")
    .eq("id", user.id)
    .single();

  const isAdmin =
    profile?.app_role === "admin" ||
    profile?.team_role === "captain" ||
    profile?.team_role === "assistant_captain";

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { email, password, first_name, last_name, jersey_number, position } = body;

  if (!email || !password || !first_name || !last_name) {
    return NextResponse.json(
      { error: "Email, password, first name, and last name are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Create auth user — trigger will create profile
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name, last_name },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  // Update profile with additional fields
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      jersey_number: jersey_number ? parseInt(jersey_number) : null,
      position: position || "forward",
      is_approved: true,
      is_active: true,
    })
    .eq("id", newUser.user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ id: newUser.user.id });
}
