// Elo rating utilities for TopBet algorithm

/**
 * Expected win probability for home team using Elo ratings.
 * homeAdvantage default: 50 Elo points.
 */
export function eloWinProb(homeElo: number, awayElo: number, homeAdvantage = 50): number {
  return 1 / (1 + Math.pow(10, (awayElo - homeElo - homeAdvantage) / 400));
}

/**
 * Approximate team Elo from league table position.
 * Position 1 → ~1750, last position → ~1250 (linear interpolation).
 */
export function teamEloFromPosition(position: number, totalTeams: number): number {
  if (totalTeams <= 1) return 1500;
  return 1750 - ((position - 1) / (totalTeams - 1)) * 500;
}

/**
 * Approximate NBA team Elo from win percentage.
 * 0.7 win% → ~1700, 0.3 win% → ~1300, 0.5 → ~1500.
 */
export function teamEloFromWinPct(winPct: number): number {
  return 1250 + winPct * 500;
}
