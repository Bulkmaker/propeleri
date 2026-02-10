import { useTranslations } from "next-intl";
import Image from "next/image";

export function Footer() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/40 bg-card/50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="HC Propeleri" width={32} height={32} />
            <div>
              <p className="font-semibold text-sm">{t("club")}</p>
              <p className="text-xs text-muted-foreground">{t("description")}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            &copy; {year} HC Propeleri. {t("rights")}.
          </p>
        </div>
      </div>
    </footer>
  );
}
