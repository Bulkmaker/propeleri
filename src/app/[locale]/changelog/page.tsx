import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollText } from "lucide-react";
import { CHANGELOG_DATA, type ChangeCategory } from "@/data/changelog";
import { formatInBelgrade } from "@/lib/utils/datetime";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("changelog.title"),
    description: t("changelog.description"),
    alternates: {
      canonical: locale === "sr" ? "/changelog" : `/${locale}/changelog`,
      languages: { sr: "/changelog", ru: "/ru/changelog", en: "/en/changelog" },
    },
    openGraph: { title: t("changelog.title"), description: t("changelog.description") },
  };
}

const CATEGORY_BADGE_CLASS: Record<ChangeCategory, string> = {
  feature: "bg-primary/20 text-primary border-primary/30",
  fix: "bg-green-500/20 text-green-500 border-green-500/30",
  refactor: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  style: "bg-purple-500/20 text-purple-500 border-purple-500/30",
  perf: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  security: "bg-red-500/20 text-red-500 border-red-500/30",
  docs: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  chore: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

function groupByDate(entries: typeof CHANGELOG_DATA) {
  const groups = new Map<string, typeof CHANGELOG_DATA>();

  for (const entry of entries) {
    const existing = groups.get(entry.date);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(entry.date, [entry]);
    }
  }

  return Array.from(groups.entries())
    .map(([date, items]) => ({ date, entries: items }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getLocaleCode(locale: string) {
  if (locale === "en") return "en-US";
  if (locale === "ru") return "ru-RU";
  return "sr-Latn";
}

export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("changelog");
  const grouped = groupByDate(CHANGELOG_DATA);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={ScrollText}
      />

      <div className="space-y-10">
        {grouped.map((group) => {
          const dateLabel = formatInBelgrade(
            group.date + "T12:00:00Z",
            getLocaleCode(locale),
            { day: "numeric", month: "long", year: "numeric" }
          );

          return (
            <div key={group.date} className="space-y-4">
              <div className="flex items-center gap-3 border-l-4 border-primary pl-4">
                <h2 className="text-xl font-bold">{dateLabel}</h2>
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/30"
                >
                  {group.entries.length}
                </Badge>
              </div>

              <div className="space-y-2 pl-4">
                {group.entries.map((entry, idx) => {
                  const description =
                    locale === "ru"
                      ? entry.description_ru
                      : locale === "en"
                        ? entry.description_en
                        : entry.description;

                  return (
                    <div key={`${entry.date}-${idx}`}>
                      <Card className="border-border/40">
                        <CardContent className="px-4 py-3 flex items-start gap-3">
                          <Badge
                            variant="outline"
                            className={`shrink-0 mt-0.5 ${CATEGORY_BADGE_CLASS[entry.category]}`}
                          >
                            {t(`categories.${entry.category}`)}
                          </Badge>
                          <p className="text-sm text-foreground leading-relaxed">
                            {description}
                          </p>
                        </CardContent>
                      </Card>
                      {idx < group.entries.length - 1 && (
                        <Separator className="my-1 bg-border/20" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
