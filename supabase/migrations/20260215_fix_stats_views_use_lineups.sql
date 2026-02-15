-- Fix: stats views should use game_lineups as base table, not game_stats
-- This ensures ALL players from lineups appear in stats (not just those with points)
-- and games_played counts all lineup appearances

CREATE OR REPLACE VIEW player_game_totals AS
SELECT
  gl.player_id,
  p.first_name, p.last_name, p.jersey_number, p.position, p.avatar_url, p.team_role,
  count(DISTINCT gl.game_id) AS games_played,
  COALESCE(sum(gs.goals), 0) AS total_goals,
  COALESCE(sum(gs.assists), 0) AS total_assists,
  (COALESCE(sum(gs.goals), 0) + COALESCE(sum(gs.assists), 0)) AS total_points,
  COALESCE(sum(gs.penalty_minutes), 0) AS total_pim,
  COALESCE(sum(gs.plus_minus), 0) AS total_plus_minus
FROM game_lineups gl
JOIN profiles p ON gl.player_id = p.id
LEFT JOIN game_stats gs ON gl.game_id = gs.game_id AND gl.player_id = gs.player_id
WHERE p.is_active = true
GROUP BY gl.player_id, p.first_name, p.last_name, p.jersey_number, p.position, p.avatar_url, p.team_role;

CREATE OR REPLACE VIEW player_season_stats AS
SELECT
  gl.player_id,
  g.season_id,
  s.name AS season_name,
  count(DISTINCT gl.game_id) AS games_played,
  COALESCE(sum(gs.goals), 0) AS goals,
  COALESCE(sum(gs.assists), 0) AS assists,
  (COALESCE(sum(gs.goals), 0) + COALESCE(sum(gs.assists), 0)) AS points,
  COALESCE(sum(gs.penalty_minutes), 0) AS pim,
  COALESCE(sum(gs.plus_minus), 0) AS plus_minus
FROM game_lineups gl
JOIN games g ON gl.game_id = g.id
JOIN seasons s ON g.season_id = s.id
LEFT JOIN game_stats gs ON gl.game_id = gs.game_id AND gl.player_id = gs.player_id
WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = gl.player_id AND p.is_active = true)
GROUP BY gl.player_id, g.season_id, s.name;
