import { BetSuggestion } from "./bet-analyzer";

export interface Parlay {
  legs: ParlayLeg[];
  combinedOdds: number;
  combinedProb: number;
  combinedEdge: number;
  combinedEdgePct: string;
  tier: "🔥🔥 Power Parlay" | "🔥 Strong Parlay" | "✅ Value Parlay";
  kellySuggestion: string;
}

export interface ParlayLeg {
  match: string;
  league: string;
  kickoff: string;
  market: string;
  pick: string;
  odds: number;
  modelProb: number;
  edgePct: string;
}

export function buildParlays(
  matches: Array<{ homeTeam: string; awayTeam: string; league: string; commenceTime: string; bets: BetSuggestion[] }>,
  maxLegs = 3
): Parlay[] {
  // Collect all value bets that have real odds (odds > 1)
  const candidates: ParlayLeg[] = [];
  for (const m of matches) {
    for (const b of m.bets ?? []) {
      if (!b.value || !b.odds || b.odds <= 1 || b.edge < 0.05) continue;
      candidates.push({
        match: `${m.homeTeam} vs ${m.awayTeam}`,
        league: m.league,
        kickoff: m.commenceTime,
        market: b.market,
        pick: b.pick,
        odds: b.odds,
        modelProb: b.modelProb ?? 0,
        edgePct: `+${Math.round(b.edge * 100)}%`,
      });
    }
  }

  // Sort by edge descending
  candidates.sort((a, b) => parseFloat(b.edgePct) - parseFloat(a.edgePct));

  const parlays: Parlay[] = [];

  // Build 2-leg parlays from top picks across DIFFERENT matches
  for (let i = 0; i < Math.min(candidates.length, 8); i++) {
    for (let j = i + 1; j < Math.min(candidates.length, 8); j++) {
      const a = candidates[i], b = candidates[j];
      // Must be different matches
      if (a.match === b.match) continue;
      // Must both have odds > 1
      if (!a.odds || !b.odds) continue;

      const legs = [a, b];
      const combinedOdds = Math.round(a.odds * b.odds * 100) / 100;
      const combinedProb = a.modelProb * b.modelProb;
      const fairOdds = combinedProb > 0 ? 1 / combinedProb : 99;
      const combinedEdge = Math.round(((combinedOdds / fairOdds) - 1) * 100) / 100;
      if (combinedEdge <= 0) continue;

      const kelly = Math.max(0, combinedEdge / (combinedOdds - 1)) / 4;
      parlays.push({
        legs,
        combinedOdds,
        combinedProb: Math.round(combinedProb * 1000) / 10,
        combinedEdge,
        combinedEdgePct: `+${Math.round(combinedEdge * 100)}%`,
        tier: combinedEdge >= 0.15 ? "🔥🔥 Power Parlay" : combinedEdge >= 0.08 ? "🔥 Strong Parlay" : "✅ Value Parlay",
        kellySuggestion: kelly > 0 ? `${(kelly * 100).toFixed(1)}% of bankroll` : "N/A",
      });

      if (parlays.length >= 6) break;
    }
    if (parlays.length >= 6) break;
  }

  // Build 3-leg parlays
  if (maxLegs >= 3) {
    for (let i = 0; i < Math.min(candidates.length, 6); i++) {
      for (let j = i + 1; j < Math.min(candidates.length, 6); j++) {
        for (let k = j + 1; k < Math.min(candidates.length, 6); k++) {
          const a = candidates[i], b = candidates[j], c = candidates[k];
          if (a.match === b.match || b.match === c.match || a.match === c.match) continue;
          if (!a.odds || !b.odds || !c.odds) continue;

          const legs = [a, b, c];
          const combinedOdds = Math.round(a.odds * b.odds * c.odds * 100) / 100;
          const combinedProb = a.modelProb * b.modelProb * c.modelProb;
          const fairOdds = combinedProb > 0 ? 1 / combinedProb : 999;
          const combinedEdge = Math.round(((combinedOdds / fairOdds) - 1) * 100) / 100;
          if (combinedEdge <= 0) continue;

          const kelly = Math.max(0, combinedEdge / (combinedOdds - 1)) / 4;
          parlays.push({
            legs,
            combinedOdds,
            combinedProb: Math.round(combinedProb * 1000) / 10,
            combinedEdge,
            combinedEdgePct: `+${Math.round(combinedEdge * 100)}%`,
            tier: combinedEdge >= 0.20 ? "🔥🔥 Power Parlay" : combinedEdge >= 0.10 ? "🔥 Strong Parlay" : "✅ Value Parlay",
            kellySuggestion: kelly > 0 ? `${(kelly * 100).toFixed(1)}% of bankroll` : "N/A",
          });

          if (parlays.length >= 10) break;
        }
        if (parlays.length >= 10) break;
      }
      if (parlays.length >= 10) break;
    }
  }

  return parlays.sort((a, b) => b.combinedEdge - a.combinedEdge).slice(0, 6);
}
