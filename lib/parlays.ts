import { BetSuggestion } from "./bet-analyzer";

export interface Parlay {
  legs: ParlayLeg[];
  combinedOdds: number;
  combinedProb: number;      // percentage (0-100)
  combinedEdge: number;
  combinedEdgePct: string;
  tier: string;
  kellySuggestion: string;
  strategy: 'high-confidence' | 'value-accumulator' | 'power-parlay' | 'league-spread';
  reason: string;
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

interface CandidateLeg extends ParlayLeg {
  rawEdge: number;
}

function computeParlay(legs: ParlayLeg[]): {
  combinedOdds: number;
  combinedProb: number;
  combinedEdge: number;
} {
  const combinedOdds = Math.round(legs.reduce((acc, l) => acc * l.odds, 1) * 100) / 100;
  const combinedProbRaw = legs.reduce((acc, l) => acc * l.modelProb, 1);
  const fairOdds = combinedProbRaw > 0 ? 1 / combinedProbRaw : 9999;
  const combinedEdge = Math.round(((combinedOdds / fairOdds) - 1) * 100) / 100;
  const combinedProb = Math.round(combinedProbRaw * 1000) / 10;
  return { combinedOdds, combinedEdge, combinedProb };
}

function tierForStrategy(strategy: Parlay['strategy']): string {
  switch (strategy) {
    case 'high-confidence': return '🎯 High Confidence';
    case 'value-accumulator': return '💰 Value Accumulator';
    case 'power-parlay': return '🚀 Power Parlay';
    case 'league-spread': return '🌍 League Spread';
  }
}

export function buildParlays(
  matches: Array<{ homeTeam: string; awayTeam: string; league: string; commenceTime: string; bets: BetSuggestion[] }>,
): Parlay[] {
  // Collect all valid candidate legs — no artificial top-N cap
  const allCandidates: CandidateLeg[] = [];
  for (const m of matches) {
    for (const b of m.bets ?? []) {
      if (!b.value || !b.odds || b.odds <= 1 || b.edge <= 0) continue;
      allCandidates.push({
        match: `${m.homeTeam} vs ${m.awayTeam}`,
        league: m.league,
        kickoff: m.commenceTime,
        market: b.market,
        pick: b.pick,
        odds: b.odds,
        modelProb: b.modelProb ?? 0,
        edgePct: `+${Math.round(b.edge * 100)}%`,
        rawEdge: b.edge,
      });
    }
  }

  const usedKeys = new Set<string>();
  const parlays: Parlay[] = [];

  function parlayKey(legs: ParlayLeg[]): string {
    return legs.map(l => `${l.match}|${l.pick}`).sort().join('::');
  }

  function tryAdd(legs: CandidateLeg[], strategy: Parlay['strategy'], reason: string): boolean {
    const { combinedOdds, combinedEdge, combinedProb } = computeParlay(legs);
    if (combinedEdge <= 0) return false;
    const key = parlayKey(legs);
    if (usedKeys.has(key)) return false;
    usedKeys.add(key);
    const kelly = Math.max(0, combinedEdge / (combinedOdds - 1)) / 4;
    // Strip rawEdge from stored legs to keep ParlayLeg shape clean
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cleanLegs: ParlayLeg[] = legs.map(({ rawEdge: _rawEdge, ...leg }) => leg);
    parlays.push({
      legs: cleanLegs,
      combinedOdds,
      combinedProb,
      combinedEdge,
      combinedEdgePct: `+${Math.round(combinedEdge * 100)}%`,
      tier: tierForStrategy(strategy),
      kellySuggestion: kelly > 0 ? `${(kelly * 100).toFixed(1)}% of bankroll` : "N/A",
      strategy,
      reason,
    });
    return true;
  }

  // --- Strategy A: High Confidence ---
  // Candidates: edge ≥ 3%, odds > 1.10; sorted by modelProb descending
  {
    const cands = allCandidates
      .filter(l => l.rawEdge >= 0.03 && l.odds > 1.10)
      .sort((a, b) => b.modelProb - a.modelProb)
      .slice(0, 30);

    // Greedy pick: top N from DIFFERENT matches (optimal since sorted by modelProb desc)
    function greedyPick(n: number): CandidateLeg[] {
      const result: CandidateLeg[] = [];
      for (const c of cands) {
        if (result.some(r => r.match === c.match)) continue;
        result.push(c);
        if (result.length === n) break;
      }
      return result;
    }

    const top2 = greedyPick(2);
    if (top2.length === 2) {
      const { combinedProb } = computeParlay(top2);
      if (combinedProb >= 38) {
        const [a, b] = top2;
        const reason = `Both legs carry ${Math.round(a.modelProb * 100)}%/${Math.round(b.modelProb * 100)}% win probability. High-floor double targeting consistent outcomes over big odds.`;
        tryAdd(top2, 'high-confidence', reason);
      }
    }

    const top3 = greedyPick(3);
    if (top3.length === 3) {
      const { combinedProb } = computeParlay(top3);
      if (combinedProb >= 28) {
        const [a, b, c] = top3;
        const reason = `Top 3 by win probability: ${Math.round(a.modelProb * 100)}%/${Math.round(b.modelProb * 100)}%/${Math.round(c.modelProb * 100)}%. High-floor treble targeting consistent outcomes.`;
        tryAdd(top3, 'high-confidence', reason);
      }
    }
  }

  // --- Strategy B: Value Accumulator ---
  // Candidates: edge ≥ 6%, odds > 1.20; sorted by edge descending
  {
    const cands = allCandidates
      .filter(l => l.rawEdge >= 0.06 && l.odds > 1.20)
      .sort((a, b) => b.rawEdge - a.rawEdge)
      .slice(0, 30);

    // 2-leg: best combined edge from different matches AND different leagues
    let best2: { legs: CandidateLeg[]; edge: number } | null = null;
    for (let i = 0; i < cands.length; i++) {
      for (let j = i + 1; j < cands.length; j++) {
        const a = cands[i], b = cands[j];
        if (a.match === b.match) continue;
        if (a.league === b.league) continue;
        const { combinedEdge } = computeParlay([a, b]);
        if (combinedEdge <= 0) continue;
        if (!best2 || combinedEdge > best2.edge) {
          best2 = { legs: [a, b], edge: combinedEdge };
        }
      }
    }
    if (best2) {
      const [a, b] = best2.legs;
      const totalEdgePct = Math.round(a.rawEdge * 100) + Math.round(b.rawEdge * 100);
      const reason = `Combined model edge of +${totalEdgePct}% across ${a.league} + ${b.league}. Both picks backed by strong value data.`;
      tryAdd(best2.legs, 'value-accumulator', reason);
    }

    // 3-leg: best combined edge, at least 2 different leagues
    let best3: { legs: CandidateLeg[]; edge: number } | null = null;
    for (let i = 0; i < cands.length; i++) {
      for (let j = i + 1; j < cands.length; j++) {
        for (let k = j + 1; k < cands.length; k++) {
          const a = cands[i], b = cands[j], c = cands[k];
          if (a.match === b.match || b.match === c.match || a.match === c.match) continue;
          const leagues = new Set([a.league, b.league, c.league]);
          if (leagues.size < 2) continue;
          const { combinedEdge } = computeParlay([a, b, c]);
          if (combinedEdge <= 0) continue;
          if (!best3 || combinedEdge > best3.edge) {
            best3 = { legs: [a, b, c], edge: combinedEdge };
          }
        }
      }
    }
    if (best3) {
      const [a, b, c] = best3.legs;
      const leagues = [...new Set([a.league, b.league, c.league])].join(' + ');
      const totalEdgePct = Math.round(a.rawEdge * 100) + Math.round(b.rawEdge * 100) + Math.round(c.rawEdge * 100);
      const reason = `Combined model edge of +${totalEdgePct}% across ${leagues}. All legs backed by xG and form data.`;
      tryAdd(best3.legs, 'value-accumulator', reason);
    }
  }

  // --- Strategy C: Power Parlay ---
  // Candidates: edge ≥ 5%, odds 1.50–4.50; optimize combinedOdds × combinedEdge
  {
    const cands = allCandidates
      .filter(l => l.rawEdge >= 0.05 && l.odds >= 1.50 && l.odds <= 4.50)
      .slice(0, 30);

    const results: { legs: CandidateLeg[]; score: number; combinedOdds: number }[] = [];
    for (let i = 0; i < cands.length; i++) {
      for (let j = i + 1; j < cands.length; j++) {
        for (let k = j + 1; k < cands.length; k++) {
          const a = cands[i], b = cands[j], c = cands[k];
          if (a.match === b.match || b.match === c.match || a.match === c.match) continue;
          const { combinedOdds, combinedEdge } = computeParlay([a, b, c]);
          if (combinedEdge <= 0 || combinedOdds < 5.0) continue;
          results.push({ legs: [a, b, c], score: combinedOdds * combinedEdge, combinedOdds });
        }
      }
    }
    results.sort((a, b) => b.score - a.score);

    let added = 0;
    for (const r of results) {
      if (added >= 2) break;
      const leagues = [...new Set(r.legs.map(l => l.league))].join(', ');
      const reason = `High R/R accumulator. Combined odds ${r.combinedOdds.toFixed(1)}x with positive model edge across ${leagues}.`;
      if (tryAdd(r.legs, 'power-parlay', reason)) added++;
    }
  }

  // --- Strategy D: League Spread ---
  // Best bet per league (highest rawEdge); build 3-leg from different leagues
  {
    const leagueMap = new Map<string, CandidateLeg>();
    for (const l of allCandidates) {
      const existing = leagueMap.get(l.league);
      if (!existing || l.rawEdge > existing.rawEdge) {
        leagueMap.set(l.league, l);
      }
    }

    const perLeague = Array.from(leagueMap.values());
    let best: { legs: CandidateLeg[]; edge: number } | null = null;
    for (let i = 0; i < perLeague.length; i++) {
      for (let j = i + 1; j < perLeague.length; j++) {
        for (let k = j + 1; k < perLeague.length; k++) {
          const a = perLeague[i], b = perLeague[j], c = perLeague[k];
          // Guaranteed different leagues since one per league
          if (a.match === b.match || b.match === c.match || a.match === c.match) continue;
          const { combinedEdge } = computeParlay([a, b, c]);
          if (combinedEdge <= 0) continue;
          if (!best || combinedEdge > best.edge) {
            best = { legs: [a, b, c], edge: combinedEdge };
          }
        }
      }
    }
    if (best) {
      const leagues = best.legs.map(l => l.league).join(', ');
      const reason = `Diversified 3-leg across ${leagues}. One strong pick from each competition.`;
      tryAdd(best.legs, 'league-spread', reason);
    }
  }

  return parlays;
}
