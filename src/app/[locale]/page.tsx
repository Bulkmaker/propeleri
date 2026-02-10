import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Trophy,
  Users,
  TrendingUp,
  ChevronRight,
  Swords,
} from "lucide-react";
import Image from "next/image";

export default function HomePage() {
  const t = useTranslations("home");
  const tc = useTranslations("common");

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden hero-gradient">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25% 50%, rgba(232,115,42,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(232,115,42,0.15) 0%, transparent 50%)",
            }}
          />
        </div>

        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            {/* Team logo */}
            <Image
              src="/logo.png"
              alt="HC Propeleri"
              width={120}
              height={120}
              className="mx-auto mb-6 drop-shadow-[0_0_30px_rgba(232,115,42,0.3)]"
              priority
            />

            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-4">
              {t("hero.title").split("Propeleri")[0]}
              <span className="text-primary">Propeleri</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8">
              {t("hero.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/schedule">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-white font-semibold px-8"
                >
                  <CalendarDays className="mr-2 h-5 w-5" />
                  {t("hero.cta")}
                </Button>
              </Link>
              <Link href="/roster">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary/30 hover:bg-primary/10 hover:text-primary"
                >
                  <Users className="mr-2 h-5 w-5" />
                  {tc("roster")}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Stats bar */}
      <section className="border-b border-border/40 bg-card/30">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatItem icon={<Users className="h-5 w-5" />} value="--" label={t("teamStats")} />
            <StatItem icon={<Swords className="h-5 w-5" />} value="--" label={tc("games")} />
            <StatItem icon={<Trophy className="h-5 w-5" />} value="--" label={tc("stats")} />
            <StatItem icon={<TrendingUp className="h-5 w-5" />} value="--" label={tc("training")} />
          </div>
        </div>
      </section>

      {/* Main content grid */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Next Game Widget */}
          <Card className="md:col-span-2 lg:col-span-2 orange-glow border-primary/20 bg-gradient-to-br from-card to-card/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Swords className="h-5 w-5 text-primary" />
                {t("nextGame")}
              </CardTitle>
              <Link href="/games">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                  {tc("viewAll")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <p className="text-muted-foreground text-sm mb-2">{t("noUpcoming")}</p>
                  <p className="text-xs text-muted-foreground">
                    Utakmice ce se pojaviti ovde kada budu zakazane
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Scorers Widget */}
          <Card className="border-border/40 card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-yellow-500" />
                {t("topScorers")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm text-center py-6">
                  {tc("noData")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Results */}
          <Card className="md:col-span-2 lg:col-span-2 border-border/40 card-hover">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-green-500" />
                {t("recentResults")}
              </CardTitle>
              <Link href="/games">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                  {tc("viewAll")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm text-center py-6">
                {tc("noData")}
              </p>
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card className="border-border/40 card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5 text-blue-400" />
                {t("upcoming")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm text-center py-6">
                {tc("noData")}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function StatItem({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-primary">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
