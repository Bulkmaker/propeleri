"use client";

import { useParams } from "next/navigation";
import { GameLineupEditor } from "@/components/games/GameLineupEditor";

export default function LineupPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  return <GameLineupEditor gameId={gameId} />;
}
