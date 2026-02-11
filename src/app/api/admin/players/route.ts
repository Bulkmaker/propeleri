import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildTechnicalEmail,
  isValidLogin,
  loginToEmail,
  normalizeLogin,
} from "@/lib/auth/login";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
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
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }

  return { userId: user.id } as const;
}

function normalizeCredentials(login?: string, password?: string) {
  const normalizedLogin = normalizeLogin(login ?? "");
  const normalizedPassword = password ?? "";
  const hasLogin = normalizedLogin.length > 0;
  const hasPassword = normalizedPassword.length > 0;

  if (hasLogin !== hasPassword) {
    return {
      error: "Login and password should be filled together",
    } as const;
  }

  if (hasLogin && !isValidLogin(normalizedLogin)) {
    return {
      error: "Login must be 3-32 chars: a-z, 0-9, dot, underscore or hyphen",
    } as const;
  }

  return {
    username: hasLogin ? normalizedLogin : null,
    email: hasLogin ? loginToEmail(normalizedLogin) : buildTechnicalEmail(),
    password: hasPassword ? normalizedPassword : crypto.randomUUID(),
    hasLogin,
  } as const;
}

function mapAuthAdminError(message: string) {
  if (message.includes("Database error loading user")) {
    return "Auth account has legacy token fields in an invalid state. Run auth token normalization migration and retry.";
  }

  return message;
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  const body = await request.json();
  const { login, password, first_name, last_name, nickname, jersey_number, position, is_guest } = body;
  const normalizedFirstName = typeof first_name === "string" ? first_name.trim() : "";
  const normalizedLastName = typeof last_name === "string" ? last_name.trim() : "";
  const normalizedIsGuest = Boolean(is_guest);

  if (!normalizedFirstName) {
    return NextResponse.json(
      { error: "First name is required" },
      { status: 400 }
    );
  }

  const credentials = normalizeCredentials(login, password);
  if ("error" in credentials) {
    return NextResponse.json({ error: credentials.error }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create auth user — trigger will create profile
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: credentials.email,
    password: credentials.password,
    email_confirm: true,
    user_metadata: {
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      nickname: typeof nickname === "string" && nickname.trim().length > 0 ? nickname.trim() : null,
      username: credentials.username,
    },
  });

  if (createError) {
    return NextResponse.json({ error: mapAuthAdminError(createError.message) }, { status: 400 });
  }

  // Update profile with additional fields
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      email: credentials.email,
      username: credentials.username,
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      nickname: typeof nickname === "string" && nickname.trim().length > 0 ? nickname.trim() : null,
      jersey_number: jersey_number ? parseInt(jersey_number) : null,
      position: position || "forward",
      is_guest: normalizedIsGuest,
      is_approved: true,
      is_active: true,
    })
    .eq("id", newUser.user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ id: newUser.user.id, hasLogin: credentials.hasLogin });
}

export async function PATCH(request: NextRequest) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  const body = await request.json();
  const { id, login, password } = body as {
    id?: string;
    login?: string;
    password?: string;
  };

  if (!id) {
    return NextResponse.json({ error: "Player ID is required" }, { status: 400 });
  }

  const normalizedLogin = normalizeLogin(login ?? "");
  const normalizedPassword = password ?? "";
  if (!normalizedLogin || !normalizedPassword) {
    return NextResponse.json(
      { error: "Login and password are required together" },
      { status: 400 }
    );
  }

  if (!isValidLogin(normalizedLogin)) {
    return NextResponse.json(
      { error: "Login must be 3-32 chars: a-z, 0-9, dot, underscore or hyphen" },
      { status: 400 }
    );
  }

  const normalizedEmail = loginToEmail(normalizedLogin);
  const admin = createAdminClient();

  const { error: authError } = await admin.auth.admin.updateUserById(id, {
    email: normalizedEmail,
    password: normalizedPassword,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: mapAuthAdminError(authError.message) }, { status: 400 });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ email: normalizedEmail, username: normalizedLogin })
    .eq("id", id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ id, hasLogin: true });
}
