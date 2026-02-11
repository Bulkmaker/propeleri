import { redirect } from "next/navigation";

export default async function AdminGamePage({
  params,
}: {
  params: Promise<{ locale: string; gameId: string }>;
}) {
  const { locale, gameId } = await params;
  redirect(`/${locale}/admin/games?gameId=${encodeURIComponent(gameId)}`);
}
