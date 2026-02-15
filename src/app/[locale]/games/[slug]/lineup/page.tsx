"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

const GameLineupEditor = dynamic(
  () => import("@/components/games/GameLineupEditor").then((m) => m.GameLineupEditor),
  { loading: () => <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> }
);

export default function LineupPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  return <GameLineupEditor gameId={gameId} />;
}
