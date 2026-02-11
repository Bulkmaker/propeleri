"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { isValidLogin, loginToEmail, normalizeLogin } from "@/lib/auth/login";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const normalizedLogin = normalizeLogin(login);
    if (!normalizedLogin) {
      setError(t("loginRequired"));
      return;
    }

    if (!normalizedLogin.includes("@") && !isValidLogin(normalizedLogin)) {
      setError(t("invalidLoginFormat"));
      return;
    }

    setLoading(true);

    const email = normalizedLogin.includes("@")
      ? normalizedLogin
      : loginToEmail(normalizedLogin);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/profile");
    router.refresh();
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-border/40 bg-card">
        <CardHeader className="text-center">
          <Image
            src="/logo.svg"
            alt="HC Propeleri"
            width={56}
            height={56}
            className="mx-auto mb-2"
          />
          <CardTitle className="text-2xl font-bold">{t("loginTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login">{t("loginField")}</Label>
              <Input
                id="login"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder={t("loginPlaceholder")}
                required
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background border-border"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("loginButton")}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/register" className="text-primary hover:underline font-medium">
              {t("registerButton")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
