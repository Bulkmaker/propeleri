type PlayerNameShape = {
  first_name: string;
  last_name: string;
  nickname?: string | null;
  jersey_number?: number | null;
};

export function formatPlayerName(player: PlayerNameShape) {
  const first = player.first_name?.trim() ?? "";
  const last = player.last_name?.trim() ?? "";
  const nickname = player.nickname?.trim();

  if (nickname) {
    const parts = [first, `"${nickname}"`, last].filter(Boolean);
    return parts.join(" ");
  }

  return `${first} ${last}`.trim();
}

export function formatPlayerNameWithNumber(player: PlayerNameShape) {
  const number = player.jersey_number != null ? `#${player.jersey_number} ` : "";
  return `${number}${formatPlayerName(player)}`.trim();
}
