// CS2 Elo prediction model
// Uses HLTV ranking points as Elo proxy + form bonus + LAN adjustment

import { CS2Team, CS2Match, CS2Result, getTeamRank, getTeamForm } from "./hltv";

export interface CS2Prediction {
  matchId: string;
  team1: string;
  team2: string;
  team1Rank: number;
  team2Rank: number;
  team1Elo: number;
  team2Elo: number;
  team1Form: string[];
  team2Form: string[];
  team1WinProb: number;
  team2WinProb: number;
  event: string;
  date: string;
  format: "BO1" | "BO3" | "BO5";
  isLan: boolean;
  // Picks output
  pick: string;        // Team name to bet on
  pickProb: number;    // Model probability for picked team
  edge: number;        // vs market odds (if available)
  marketOdds: number | null;
  marketProb: number | null;
  tier: "🔒 LOCK" | "🎯 STRONG" | "⚡ SPEC";
  confidence: number;  // 0-100
  reasoning: string;
}

// ─── Elo from HLTV ranking ──────────────────────────────────────────────────
// Rank 1 → 1800, Rank 30 → 1200, linear interpolation
function hltvRankToElo(rank: number): number {
  if (rank <= 0) return 1200;
  if (rank > 30) return 1150;
  return 1800 - ((rank - 1) / 29) * 600;
}

// ─── Form bonus ─────────────────────────────────────────────────────────────
// +15 per win, -15 per loss in last 5 matches
function formBonus(form: string[]): number {
  let bonus = 0;
  for (const result of form) {
    if (result === "W") bonus += 15;
    else if (result === "L") bonus -= 15;
  }
  return bonus;
}

// ─── LAN bonus ──────────────────────────────────────────────────────────────
// Higher-ranked team gets +30 on LAN (top teams perform better on stage)
function lanBonus(isLan: boolean, team1Rank: number, team2Rank: number): { team1Bonus: number; team2Bonus: number } {
  if (!isLan) return { team1Bonus: 0, team2Bonus: 0 };
  if (team1Rank < team2Rank) return { team1Bonus: 30, team2Bonus: 0 };
  if (team2Rank < team1Rank) return { team1Bonus: 0, team2Bonus: 30 };
  return { team1Bonus: 0, team2Bonus: 0 };
}

// ─── Format volatility ─────────────────────────────────────────────────────
// BO1 is more volatile — reduce confidence, BO3/BO5 is more predictable
function formatConfidenceMultiplier(format: "BO1" | "BO3" | "BO5"): number {
  switch (format) {
    case "BO1": return 0.75; // High variance
    case "BO3": return 1.0;  // Standard
    case "BO5": return 1.1;  // Most predictable
  }
}

// ─── Win probability (standard Elo formula) ─────────────────────────────────
function eloWinProb(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

// ─── Tier assignment ────────────────────────────────────────────────────────
function assignTier(edge: number, confidence: number): "🔒 LOCK" | "🎯 STRONG" | "⚡ SPEC" {
  if (confidence >= 78 && edge >= 0.12) return "🔒 LOCK";
  if (confidence >= 65 && edge >= 0.07) return "🎯 STRONG";
  return "⚡ SPEC";
}

// ─── Generate reasoning ────────────────────────────────────────────────────
function generateReasoning(pred: {
  pick: string;
  pickIsTeam1: boolean;
  team1: string;
  team2: string;
  team1Rank: number;
  team2Rank: number;
  team1Form: string[];
  team2Form: string[];
  format: string;
  isLan: boolean;
  eloDiff: number;
  pickProb: number;
}): string {
  const parts: string[] = [];
  const pickForm = pred.pickIsTeam1 ? pred.team1Form : pred.team2Form;
  const oppForm = pred.pickIsTeam1 ? pred.team2Form : pred.team1Form;
  const pickRank = pred.pickIsTeam1 ? pred.team1Rank : pred.team2Rank;
  const oppRank = pred.pickIsTeam1 ? pred.team2Rank : pred.team1Rank;
  const opp = pred.pickIsTeam1 ? pred.team2 : pred.team1;

  // Ranking context
  if (pickRank <= 5) parts.push(`${pred.pick} ranked #${pickRank} globally`);
  else parts.push(`${pred.pick} (#${pickRank}) vs ${opp} (#${oppRank})`);

  // Form
  const wins = pickForm.filter(f => f === "W").length;
  const losses = pickForm.filter(f => f === "L").length;
  if (wins >= 4) parts.push(`red-hot form (${wins}W in last 5)`);
  else if (wins >= 3) parts.push(`solid form (${wins}W-${losses}L)`);
  else if (losses >= 4) parts.push(`despite poor recent form`);

  // Opponent form
  const oppWins = oppForm.filter(f => f === "W").length;
  const oppLosses = oppForm.filter(f => f === "L").length;
  if (oppLosses >= 3) parts.push(`${opp} struggling (${oppLosses}L in last 5)`);

  // LAN/format
  if (pred.isLan && pickRank <= 5) parts.push("LAN advantage for elite teams");
  if (pred.format === "BO1") parts.push("⚠️ BO1 — higher variance");
  if (pred.format === "BO5") parts.push("BO5 favors deeper team");

  // Model confidence
  parts.push(`model gives ${Math.round(pred.pickProb * 100)}% win probability`);

  return parts.join(". ") + ".";
}

// ─── Main prediction function ───────────────────────────────────────────────

export function predictCS2Match(
  match: CS2Match,
  rankings: CS2Team[],
  results: CS2Result[],
): CS2Prediction {
  // Get team data
  const team1Data = getTeamRank(match.team1, rankings);
  const team2Data = getTeamRank(match.team2, rankings);
  const team1Rank = team1Data?.rank ?? match.team1Rank;
  const team2Rank = team2Data?.rank ?? match.team2Rank;

  // Base Elo from ranking
  let team1Elo = hltvRankToElo(team1Rank);
  let team2Elo = hltvRankToElo(team2Rank);

  // Form bonus
  const team1Form = getTeamForm(match.team1, results);
  const team2Form = getTeamForm(match.team2, results);
  team1Elo += formBonus(team1Form);
  team2Elo += formBonus(team2Form);

  // LAN bonus
  const lan = lanBonus(match.isLan, team1Rank, team2Rank);
  team1Elo += lan.team1Bonus;
  team2Elo += lan.team2Bonus;

  // Win probabilities
  const team1WinProb = eloWinProb(team1Elo, team2Elo);
  const team2WinProb = 1 - team1WinProb;

  // Pick the team with higher probability
  const pickIsTeam1 = team1WinProb >= team2WinProb;
  const pick = pickIsTeam1 ? match.team1 : match.team2;
  const pickProb = pickIsTeam1 ? team1WinProb : team2WinProb;

  // No market odds in v1 — edge is model-only
  const marketOdds: number | null = null;
  const marketProb: number | null = null;
  const edge = pickProb - 0.5; // Edge relative to coin flip baseline

  // Confidence: base from probability, adjusted by format
  const formatMult = formatConfidenceMultiplier(match.format);
  const eloDiff = Math.abs(team1Elo - team2Elo);
  const rawConfidence = Math.min(95, 50 + (eloDiff / 5));
  const confidence = Math.round(rawConfidence * formatMult);

  const tier = assignTier(edge, confidence);

  const reasoning = generateReasoning({
    pick,
    pickIsTeam1,
    team1: match.team1,
    team2: match.team2,
    team1Rank,
    team2Rank,
    team1Form,
    team2Form,
    format: match.format,
    isLan: match.isLan,
    eloDiff,
    pickProb,
  });

  return {
    matchId: match.id,
    team1: match.team1,
    team2: match.team2,
    team1Rank,
    team2Rank,
    team1Elo: Math.round(team1Elo),
    team2Elo: Math.round(team2Elo),
    team1Form,
    team2Form,
    team1WinProb: Math.round(team1WinProb * 1000) / 1000,
    team2WinProb: Math.round(team2WinProb * 1000) / 1000,
    event: match.event,
    date: match.date,
    format: match.format,
    isLan: match.isLan,
    pick,
    pickProb: Math.round(pickProb * 1000) / 1000,
    edge: Math.round(edge * 1000) / 1000,
    marketOdds,
    marketProb,
    tier,
    confidence,
    reasoning,
  };
}

// ─── Batch predict all upcoming matches ─────────────────────────────────────

export function predictAllCS2Matches(
  matches: CS2Match[],
  rankings: CS2Team[],
  results: CS2Result[],
): CS2Prediction[] {
  return matches.map(m => predictCS2Match(m, rankings, results));
}
