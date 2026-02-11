type PlayerNameShape = {
  first_name: string;
  last_name: string;
  nickname?: string | null;
  jersey_number?: number | null;
};

export function formatPlayerName(player: PlayerNameShape) {
  const base = `${player.first_name} ${player.last_name}`.trim();
  const nickname = player.nickname?.trim();
  return nickname ? `${base} (${nickname})` : base;
}

export function formatPlayerNameWithNumber(player: PlayerNameShape) {
  const number = player.jersey_number != null ? `#${player.jersey_number} ` : "";
  return `${number}${formatPlayerName(player)}`.trim();
}
