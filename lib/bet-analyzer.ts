// Multi-market bet analyzer — TopBet v2
// Improvements: Dixon-Coles correction, Elo ratings, Kelly Criterion, Factor breakdown, Referee Intelligence

import { eloWinProb } from "./elo";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FactorBreakdown {
  label: string;     // e.g. "Form edge", "Elo gap", "H2H record", "Mispricing"
  impact: number;    // -1 to +1, contribution to edge
  direction: "+" | "-" | "=";
}

export interface BetSuggestion {
  market: string;          // "Match Result" | "Over 2.5 Goals" | "BTTS" | etc
  pick: string;            // "Home Win" | "Over 2.5" | "Yes" | "Away -1.5" etc
  confidence: number;      // 0–100
  edge: number;            // modelProb - marketProb
  modelProb: number;       // our calculated probability (0–1)
  marketProb: number;      // market implied probability de-vigged (0–1)
  odds?: number;           // decimal odds for this selection
  value: boolean;          // true if edge >= 0.05
  reasoning: string;       // one-line explanation
  tier: "🔥 Strong" | "✅ Lean" | "⚠️ Marginal";
  kellySuggestion: string; // "2.3% of bankroll" or "No edge (Kelly = 0)"
  factors?: FactorBreakdown[];
  refereeNote?: string;    // "⚖️ M. Oliver: strict on cards, 0.28 penalties/game"
  // Best book fields (Feature 3)
  bestBook?: string;       // "Bet365", "BetWay", etc.
  bestOdds?: number;       // Best available odds across all books
  bestEdge?: number;       // Edge vs Pinnacle fair value at BEST odds
}

// ─── Referee stats shape (mirrors lib/referees.ts — kept loose to avoid circular) ─

interface RefereeStatsInput {
  cardStyle: "lenient" | "average" | "strict";
  yellowCardsPerGame: number;
  redCardsPerGame: number;
  penaltiesPerGame: number;
  varInterventionsPerGame: number;
  homeBias: number;
  notes: string;
}

// ─── Weather shape (loose to avoid circular) ─────────────────────────────────
interface WeatherInput {
  goalsImpact: number;
  cornersImpact: number;
  icon: string;
  description: string;
  tempC: number;
  rainMm: number;
  windKph: number;
}

// ─── Motivation model (Feature 4) ────────────────────────────────────────────
interface MotivationFactors {
  homeMotivation: number;  // 0.7 to 1.3 multiplier
  awayMotivation: number;
  notes: string[];
}

function calcMotivation(match: {
  homeTablePos?: number;
  awayTablePos?: number;
  league?: string;
}): MotivationFactors {
  const notes: string[] = [];
  let home = 1.0, away = 1.0;

  if (match.homeTablePos) {
    if (match.homeTablePos >= 17) { home *= 1.15; notes.push("Home fighting relegation ⚡"); }
    else if (match.homeTablePos <= 4) { home *= 1.10; notes.push("Home in top-4 race ⚡"); }
    else if (match.homeTablePos >= 8 && match.homeTablePos <= 14) { home *= 0.95; }
  }
  if (match.awayTablePos) {
    if (match.awayTablePos >= 17) { away *= 1.15; notes.push("Away fighting relegation ⚡"); }
    else if (match.awayTablePos <= 4) { away *= 1.10; notes.push("Away in top-4 race ⚡"); }
    else if (match.awayTablePos >= 8 && match.awayTablePos <= 14) { away *= 0.95; }
  }

  // UCL knockout rounds → always high motivation
  if (match.league?.toLowerCase().includes("champions")) {
    home *= 1.1; away *= 1.1;
    notes.push("UCL knockout — must-win pressure");
  }

  return { homeMotivation: home, awayMotivation: away, notes };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formScore(form: string[]): number {
  if (!form?.length) return 0.5;
  const score = form.reduce((s, r) => s + (r === "W" ? 1 : r === "D" ? 0.4 : 0), 0);
  return score / form.length;
}

function deVig(odds: number[]): number[] {
  const raw = odds.map((o) => (o > 0 ? 1 / o : 0));
  const total = raw.reduce((a, b) => a + b, 0);
  if (total === 0) return odds.map(() => 1 / odds.length);
  return raw.map((r) => r / total);
}

// Poisson probability P(X = k)
function poisson(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 0; i < k; i++) p = (p * lambda) / (i + 1);
  return p;
}

/**
 * Dixon-Coles correction factor for low-scoring scorelines.
 * rho = -0.13 is the standard calibration for EPL data.
 * Boosts 0-0 and 1-1 probabilities; slightly reduces 0-1 and 1-0.
 */
function dixonColesCorrection(
  h: number,
  a: number,
  lambdaHome: number,
  lambdaAway: number,
  rho = -0.13
): number {
  if (h === 0 && a === 0) return 1 - rho * lambdaHome * lambdaAway;
  if (h === 0 && a === 1) return 1 + rho * lambdaHome;
  if (h === 1 && a === 0) return 1 + rho * lambdaAway;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

// P(total goals > line) using Poisson + Dixon-Coles correction
function probOver(lambdaHome: number, lambdaAway: number, line: number): number {
  const maxGoals = 15;
  let probUnder = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      if (h + a <= line) {
        const dc = dixonColesCorrection(h, a, lambdaHome, lambdaAway);
        probUnder += poisson(lambdaHome, h) * poisson(lambdaAway, a) * dc;
      }
    }
  }
  return Math.min(0.97, Math.max(0.03, 1 - probUnder));
}

// P(both teams score >= 1) with Dixon-Coles correction
function probBTTS(lambdaHome: number, lambdaAway: number): number {
  let pBTTS = 0;
  for (let h = 1; h <= 12; h++) {
    for (let a = 1; a <= 12; a++) {
      const dc = dixonColesCorrection(h, a, lambdaHome, lambdaAway);
      pBTTS += poisson(lambdaHome, h) * poisson(lambdaAway, a) * dc;
    }
  }
  return Math.min(0.97, Math.max(0.03, pBTTS));
}

function edgeTier(edge: number): BetSuggestion["tier"] {
  if (edge >= 0.10) return "🔥 Strong";
  if (edge >= 0.05) return "✅ Lean";
  return "⚠️ Marginal";
}

function clamp(v: number, min = 0.03, max = 0.97): number {
  return Math.max(min, Math.min(max, v));
}

// Quarter-Kelly staking formula (safety factor = 4)
function quarterKelly(modelProb: number, decimalOdds: number): number {
  if (!decimalOdds || decimalOdds <= 1) return 0;
  const b = decimalOdds - 1;
  const kelly = (b * modelProb - (1 - modelProb)) / b;
  return Math.max(0, kelly / 4);
}

function formatKelly(modelProb: number, decimalOdds?: number): string {
  if (!decimalOdds || decimalOdds <= 1) return "No edge (Kelly = 0)";
  const k = quarterKelly(modelProb, decimalOdds);
  if (k <= 0) return "No edge (Kelly = 0)";
  return `${(k * 100).toFixed(1)}% of bankroll`;
}

function makeFactors(
  formImpact: number,
  eloImpact: number,
  h2hImpact: number,
  mispricingImpact: number
): FactorBreakdown[] {
  const dir = (v: number): "+" | "-" | "=" =>
    v > 0.02 ? "+" : v < -0.02 ? "-" : "=";
  return [
    { label: "Form edge",   impact: clamp(formImpact, -1, 1),       direction: dir(formImpact) },
    { label: "Elo gap",     impact: clamp(eloImpact, -1, 1),        direction: dir(eloImpact) },
    { label: "H2H record",  impact: clamp(h2hImpact, -1, 1),        direction: dir(h2hImpact) },
    { label: "Mispricing",  impact: clamp(mispricingImpact, -1, 1), direction: dir(mispricingImpact) },
  ];
}

function buildRefereeNote(ref: RefereeStatsInput, name: string): string {
  const parts: string[] = [];
  parts.push(`${ref.cardStyle} on cards (${ref.yellowCardsPerGame.toFixed(1)}/game)`);
  if (ref.penaltiesPerGame > 0.32) {
    parts.push(`${ref.penaltiesPerGame.toFixed(2)} penalties/game`);
  }
  if (ref.varInterventionsPerGame > 0.40) {
    parts.push("high VAR usage");
  }
  return `⚖️ ${name}: ${parts.join(", ")}`;
}

// ─── Soccer analyzer ─────────────────────────────────────────────────────────

export function analyzeSoccer(match: {
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  awayOdds: number;
  drawOdds?: number;
  homeForm: string[];
  awayForm: string[];
  h2hHomeWins: number;
  h2hTotal: number;
  h2hDraws: number;
  goalsAvgHome: number;
  goalsAvgAway: number;
  xgHome?: number;
  xgAway?: number;
  bttsProb: number;
  cleanSheetHome: number;
  cleanSheetAway: number;
  cornersAvgHome: number;
  cornersAvgAway: number;
  homeElo?: number;
  awayElo?: number;
  referee?: string | null;
  refereeStats?: RefereeStatsInput | null;
  weather?: WeatherInput | null;
  homeTablePos?: number;
  awayTablePos?: number;
  league?: string;
  // Best book odds (Feature 3)
  bestOddsHome?: number;
  bestOddsHomeBook?: string;
  bestOddsAway?: number;
  bestOddsAwayBook?: string;
  bestOddsDraw?: number;
  bestOddsDrawBook?: string;
}): BetSuggestion[] {
  const suggestions: BetSuggestion[] = [];

  const homeF = formScore(match.homeForm);
  const awayF = formScore(match.awayForm);
  const formAdv = homeF - awayF; // -1 to 1

  const h2hTotal = Math.max(match.h2hTotal, 1);
  const h2hHomeRate = match.h2hHomeWins / h2hTotal;
  const h2hDrawRate = match.h2hDraws / h2hTotal;
  const h2hAwayRate = 1 - h2hHomeRate - h2hDrawRate;

  // Feature 1: Use xG if available, fall back to goals avg
  const useXG = (match.xgHome ?? 0) > 0 && (match.xgAway ?? 0) > 0;
  const xgNote = useXG ? "Using xG data (more accurate)" : "Using goals avg (xG unavailable)";

  // Feature 2: Weather adjustment
  const weatherGoalAdj = match.weather?.goalsImpact ?? 0;
  const weatherCornersAdj = match.weather?.cornersImpact ?? 0;

  // Feature 4: Motivation
  const motivation = calcMotivation(match);

  const rawLambdaHome = useXG ? (match.xgHome ?? 1.4) : (match.goalsAvgHome || 1.4);
  const rawLambdaAway = useXG ? (match.xgAway ?? 1.1) : (match.goalsAvgAway || 1.1);

  const lambdaHome = Math.max(0.3, rawLambdaHome * (1 + weatherGoalAdj) * motivation.homeMotivation);
  const lambdaAway = Math.max(0.3, rawLambdaAway * (1 + weatherGoalAdj) * motivation.awayMotivation);

  // Elo win probabilities
  const homeElo = match.homeElo ?? 1500;
  const awayElo = match.awayElo ?? 1500;
  const eloWinHome = eloWinProb(homeElo, awayElo);    // includes 50-pt home advantage
  const eloWinAway = 1 - eloWinHome;

  // De-vig market probabilities
  const oddsArr = match.drawOdds
    ? [match.homeOdds, match.drawOdds, match.awayOdds]
    : [match.homeOdds, match.awayOdds];
  const [marketHome, marketDraw, marketAway] = match.drawOdds
    ? deVig(oddsArr)
    : [...deVig([match.homeOdds, match.awayOdds]), 0];

  // Referee note (generated once, added to relevant picks)
  const refNote =
    match.refereeStats && match.referee
      ? buildRefereeNote(match.refereeStats, match.referee)
      : undefined;

  // Referee card-market boosts
  const cardBoost = match.refereeStats?.cardStyle === "strict"
    ? 0.07
    : match.refereeStats?.cardStyle === "lenient"
    ? -0.05
    : 0;

  const varNote = (match.refereeStats?.varInterventionsPerGame ?? 0) > 0.40
    ? " High VAR risk."
    : "";

  // Build motivation note string
  const motivationNote = motivation.notes.length > 0 ? ` ${motivation.notes.join(". ")}.` : "";

  // Build weather note
  const weatherNote = match.weather
    ? ` ${match.weather.icon} ${match.weather.description} (${match.weather.tempC}°C, ${(weatherGoalAdj * 100).toFixed(0)}% goals impact).`
    : "";

  // Best book edge calculation helper
  function bestBookEdge(bestOdds: number | undefined, fairValue: number): number | undefined {
    if (!bestOdds || bestOdds <= 1) return undefined;
    return (1 / fairValue) > 0 ? (bestOdds * fairValue - 1) : undefined;
  }

  // ── 1. Match Result: Home Win ──
  const modelHome = clamp(
    marketHome * 0.35 +
    eloWinHome * 0.25 +
    (0.33 + formAdv * 0.25) * 0.25 +
    h2hHomeRate * 0.10 +
    0.05 * 0.05 // home field bonus
  );
  const edgeHome = modelHome - marketHome;
  const bestEdgeHome = bestBookEdge(match.bestOddsHome, modelHome);
  suggestions.push({
    market: "Match Result",
    pick: `${match.homeTeam} Win`,
    confidence: Math.round(modelHome * 100),
    edge: edgeHome,
    modelProb: modelHome,
    marketProb: marketHome,
    odds: match.homeOdds,
    value: edgeHome >= 0.05,
    tier: edgeTier(edgeHome),
    reasoning: `Form ${formAdv > 0 ? "favours home" : "against home"} (${match.homeForm?.slice(-3).join("") || "—"}). Elo: ${homeElo}/${awayElo} → ${Math.round(eloWinHome * 100)}% win prob. H2H: ${match.h2hHomeWins}/${h2hTotal}.${varNote}${motivationNote}${weatherNote} ${xgNote}.`,
    kellySuggestion: formatKelly(modelHome, match.homeOdds),
    factors: makeFactors(formAdv * 0.5, (eloWinHome - 0.5) * 1.5, (h2hHomeRate - 0.33) * 1.2, edgeHome),
    refereeNote: refNote,
    bestBook: match.bestOddsHomeBook,
    bestOdds: match.bestOddsHome,
    bestEdge: bestEdgeHome,
  });

  // ── 2. Match Result: Away Win ──
  const modelAway = clamp(
    marketAway * 0.35 +
    eloWinAway * 0.25 +
    (0.33 + (awayF - homeF) * 0.25) * 0.25 +
    h2hAwayRate * 0.10
  );
  const edgeAway = modelAway - marketAway;
  const bestEdgeAway = bestBookEdge(match.bestOddsAway, modelAway);
  suggestions.push({
    market: "Match Result",
    pick: `${match.awayTeam} Win`,
    confidence: Math.round(modelAway * 100),
    edge: edgeAway,
    modelProb: modelAway,
    marketProb: marketAway,
    odds: match.awayOdds,
    value: edgeAway >= 0.05,
    tier: edgeTier(edgeAway),
    reasoning: `Away form: ${match.awayForm?.slice(-3).join("") || "—"}. Elo: ${awayElo} → ${Math.round(eloWinAway * 100)}% win prob. H2H away wins: ${Math.round(h2hAwayRate * h2hTotal)}/${h2hTotal}.${varNote}${motivationNote}${weatherNote}`,
    kellySuggestion: formatKelly(modelAway, match.awayOdds),
    factors: makeFactors((awayF - homeF) * 0.5, (eloWinAway - 0.5) * 1.5, (h2hAwayRate - 0.33) * 1.2, edgeAway),
    refereeNote: refNote,
    bestBook: match.bestOddsAwayBook,
    bestOdds: match.bestOddsAway,
    bestEdge: bestEdgeAway,
  });

  // ── 3. Draw ──
  if (match.drawOdds && marketDraw > 0) {
    // Elo-based draw estimate: 1 - home_win_prob - away_win_prob (scaled from 3-outcome model)
    const eloDrawApprox = Math.max(0.15, 1 - eloWinHome * 1.2 - eloWinAway * 1.0);
    const modelDraw = clamp(
      marketDraw * 0.40 +
      eloDrawApprox * 0.20 +
      h2hDrawRate * 0.25 +
      (Math.abs(formAdv) < 0.15 ? 0.08 : 0.0)
    );
    const edgeDraw = modelDraw - marketDraw;
    const bestEdgeDraw = bestBookEdge(match.bestOddsDraw, modelDraw);
    suggestions.push({
      market: "Match Result",
      pick: "Draw",
      confidence: Math.round(modelDraw * 100),
      edge: edgeDraw,
      modelProb: modelDraw,
      marketProb: marketDraw,
      odds: match.drawOdds,
      value: edgeDraw >= 0.05,
      tier: edgeTier(edgeDraw),
      reasoning: `Teams ${Math.abs(formAdv) < 0.15 ? "evenly matched" : "have form gap"}. H2H draws: ${match.h2hDraws}/${h2hTotal}. Elo spread: ${Math.abs(homeElo - awayElo).toFixed(0)} points.`,
      kellySuggestion: formatKelly(modelDraw, match.drawOdds),
      factors: makeFactors(-(Math.abs(formAdv)) * 0.3, -(Math.abs(eloWinHome - 0.5)) * 1.5, (h2hDrawRate - 0.25) * 1.5, edgeDraw),
      refereeNote: refNote,
      bestBook: match.bestOddsDrawBook,
      bestOdds: match.bestOddsDraw,
      bestEdge: bestEdgeDraw,
    });
  }

  // ── 4. Over 2.5 Goals (Dixon-Coles) ──
  const modelOver25 = probOver(lambdaHome, lambdaAway, 2.5);
  const marketOver25 = clamp(0.5 - (marketDraw || 0.28) * 0.6 + (lambdaHome + lambdaAway - 2.5) * 0.08);
  const edgeOver25 = modelOver25 - marketOver25;
  suggestions.push({
    market: "Total Goals",
    pick: "Over 2.5 Goals",
    confidence: Math.round(modelOver25 * 100),
    edge: edgeOver25,
    modelProb: modelOver25,
    marketProb: marketOver25,
    value: edgeOver25 >= 0.05,
    tier: edgeTier(edgeOver25),
    reasoning: `Expected goals: ${lambdaHome.toFixed(2)} + ${lambdaAway.toFixed(2)} = ${(lambdaHome + lambdaAway).toFixed(2)}. Dixon-Coles Poisson: ${Math.round(modelOver25 * 100)}% chance of 3+ goals. ${xgNote}.${weatherNote}`,
    kellySuggestion: formatKelly(modelOver25, 1.85), // typical Over 2.5 odds
    factors: makeFactors((lambdaHome + lambdaAway - 2.5) * 0.2, (eloWinHome - 0.5) * 0.3, 0, edgeOver25),
  });

  // ── 5. Under 2.5 Goals ──
  const modelUnder25 = 1 - modelOver25;
  const edgeUnder25 = modelUnder25 - (1 - marketOver25);
  suggestions.push({
    market: "Total Goals",
    pick: "Under 2.5 Goals",
    confidence: Math.round(modelUnder25 * 100),
    edge: edgeUnder25,
    modelProb: modelUnder25,
    marketProb: 1 - marketOver25,
    value: edgeUnder25 >= 0.05,
    tier: edgeTier(edgeUnder25),
    reasoning: `${Math.round(modelUnder25 * 100)}% chance of 2 or fewer goals. Dixon-Coles boosts low-scoring scorelines (0-0, 1-0, 0-1).`,
    kellySuggestion: formatKelly(modelUnder25, 2.00),
    factors: makeFactors(-(lambdaHome + lambdaAway - 2.0) * 0.2, -(eloWinHome - 0.5) * 0.3, 0, edgeUnder25),
  });

  // ── 6. BTTS Yes (Dixon-Coles) ──
  const modelBTTS = probBTTS(lambdaHome, lambdaAway);
  const marketBTTS = clamp(match.bttsProb > 0 ? match.bttsProb / 100 : modelBTTS * 0.95);
  const edgeBTTS = modelBTTS - marketBTTS;
  suggestions.push({
    market: "Both Teams to Score",
    pick: "Yes",
    confidence: Math.round(modelBTTS * 100),
    edge: edgeBTTS,
    modelProb: modelBTTS,
    marketProb: marketBTTS,
    value: edgeBTTS >= 0.05,
    tier: edgeTier(edgeBTTS),
    reasoning: `Home scores in ${Math.round((1 - poisson(lambdaHome, 0)) * 100)}% of games, away in ${Math.round((1 - poisson(lambdaAway, 0)) * 100)}% of games. Dixon-Coles applied.`,
    kellySuggestion: formatKelly(modelBTTS, 1.75),
    factors: makeFactors(formAdv * 0.2, 0, 0, edgeBTTS),
  });

  // ── 7. BTTS No ──
  const modelBTTSNo = 1 - modelBTTS;
  const edgeBTTSNo = modelBTTSNo - (1 - marketBTTS);
  suggestions.push({
    market: "Both Teams to Score",
    pick: "No",
    confidence: Math.round(modelBTTSNo * 100),
    edge: edgeBTTSNo,
    modelProb: modelBTTSNo,
    marketProb: 1 - marketBTTS,
    value: edgeBTTSNo >= 0.05,
    tier: edgeTier(edgeBTTSNo),
    reasoning: `${Math.round(modelBTTSNo * 100)}% chance at least one team keeps a clean sheet.`,
    kellySuggestion: formatKelly(modelBTTSNo, 2.10),
    factors: makeFactors(-formAdv * 0.2, 0, 0, edgeBTTSNo),
  });

  // ── 8. Double Chance: Home or Draw ──
  if (match.drawOdds) {
    const modelDrawForDC = clamp(marketDraw * 0.40 + h2hDrawRate * 0.25 + (Math.abs(formAdv) < 0.15 ? 0.08 : 0.0));
    const modelHX = clamp(modelHome + modelDrawForDC);
    const marketHX = clamp(marketHome + (marketDraw || 0));
    const edgeHX = modelHX - marketHX;
    suggestions.push({
      market: "Double Chance",
      pick: "Home or Draw",
      confidence: Math.round(modelHX * 100),
      edge: edgeHX,
      modelProb: modelHX,
      marketProb: marketHX,
      value: edgeHX >= 0.05,
      tier: edgeTier(edgeHX),
      reasoning: `Combined home win + draw probability. Good when home form is strong but odds are tight.`,
      kellySuggestion: formatKelly(modelHX, 1.45),
      refereeNote: refNote,
    });
  }

  // ── 9. Corners ──
  const cornersHome = match.cornersAvgHome ?? 0;
  const cornersAway = match.cornersAvgAway ?? 0;
  if (cornersHome > 0 && cornersAway > 0) {
    const totalCornersAvg = (cornersHome + cornersAway) * (1 + weatherCornersAdj);
    const line = 9.5;
    const overProb = clamp(0.5 + (totalCornersAvg - line) * 0.04);
    const edgeCorners = overProb - 0.50;
    const cornersWeatherNote = match.weather && weatherCornersAdj !== 0
      ? ` ${match.weather.icon} Weather adj: ${(weatherCornersAdj * 100).toFixed(0)}%.`
      : "";
    suggestions.push({
      market: "Total Corners",
      pick: `Over ${line}`,
      confidence: Math.round(overProb * 100),
      edge: edgeCorners,
      modelProb: overProb,
      marketProb: 0.50,
      value: edgeCorners >= 0.05,
      tier: edgeTier(edgeCorners),
      reasoning: `Combined corners avg: ${totalCornersAvg.toFixed(1)}/game (H: ${cornersHome.toFixed(1)}, A: ${cornersAway.toFixed(1)}). Line: ${line}.${cornersWeatherNote}`,
      kellySuggestion: formatKelly(overProb, 1.90),
    });
  }

  // ── 10. Cards (with referee intelligence boost) ──
  const cardsAvgHome = (match as { cardsAvgHome?: number }).cardsAvgHome ?? 0;
  const cardsAvgAway = (match as { cardsAvgAway?: number }).cardsAvgAway ?? 0;
  if (cardsAvgHome > 0) {
    const totalCardsAvg = cardsAvgHome + cardsAvgAway;
    const cardLine = 3.5;
    const cardOverProb = clamp(0.5 + (totalCardsAvg - cardLine) * 0.08 + cardBoost);
    const edgeCards = cardOverProb - 0.5;
    const refCardNote = match.refereeStats?.cardStyle === "strict"
      ? ` Referee ${match.referee ?? ""} is strict (+7% boost applied).`
      : match.refereeStats?.cardStyle === "lenient"
      ? ` Referee ${match.referee ?? ""} is lenient (-5% reduction applied).`
      : "";
    suggestions.push({
      market: "Total Cards",
      pick: `Over ${cardLine}`,
      confidence: Math.round(cardOverProb * 100),
      edge: edgeCards,
      modelProb: cardOverProb,
      marketProb: 0.5,
      value: edgeCards >= 0.05,
      tier: edgeTier(edgeCards),
      reasoning: `Cards avg: ${cardsAvgHome.toFixed(1)}/game home, ${cardsAvgAway.toFixed(1)}/game away. Total: ${totalCardsAvg.toFixed(1)}.${refCardNote}`,
      kellySuggestion: formatKelly(cardOverProb, 1.90),
      refereeNote: refNote,
    });
  }

  // Sort: value bets first, then by edge descending
  return suggestions.sort((a, b) => {
    if (a.value !== b.value) return a.value ? -1 : 1;
    return b.edge - a.edge;
  });
}

// ─── NBA analyzer ────────────────────────────────────────────────────────────

import type { InjuredPlayer, TeamSeasonRecord } from "./balldontlie";

export interface NBAGameContext {
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  awayOdds: number;
  homeForm: string[];   // last 5 (legacy compat)
  awayForm: string[];
  h2hHomeWins: number;
  h2hTotal: number;
  goalsAvgHome: number; // points per game
  goalsAvgAway: number;
  homeElo?: number;
  awayElo?: number;
  totalLine?: number;
  // Smart context (from BallDontLie)
  homeInjuries?: InjuredPlayer[];
  awayInjuries?: InjuredPlayer[];
  homeOnBackToBack?: boolean;
  awayOnBackToBack?: boolean;
  homeRecentForm?: string[]; // last 10 games
  awayRecentForm?: string[];
  homeRecord?: TeamSeasonRecord | null;
  awayRecord?: TeamSeasonRecord | null;
}

// Injury impact per tier × status multiplier
const INJURY_TIER_IMPACT: Record<InjuredPlayer["tier"], number> = {
  superstar: 0.10,
  allstar:   0.06,
  starter:   0.025,
  rotation:  0.008,
  bench:     0.002,
};
const INJURY_STATUS_MULT: Record<InjuredPlayer["status"], number> = {
  "Out":          1.0,
  "Doubtful":     0.8,
  "Questionable": 0.4,
  "Day-To-Day":   0.2,
};

function injuryAdj(injuries: InjuredPlayer[]): number {
  return injuries.reduce((sum, p) => {
    return sum - INJURY_TIER_IMPACT[p.tier] * INJURY_STATUS_MULT[p.status];
  }, 0);
}

function injuryLabel(injuries: InjuredPlayer[]): string[] {
  return injuries
    .filter(p => p.status === "Out" && (p.tier === "superstar" || p.tier === "allstar" || p.tier === "starter"))
    .slice(0, 2)
    .map(p => `🏥 ${p.name} ${p.status} (${p.tier})`);
}

export function analyzeNBA(match: NBAGameContext): BetSuggestion[] {
  const suggestions: BetSuggestion[] = [];

  // ── STEP 1: De-vig market baseline ──
  const [marketHome, marketAway] = deVig([match.homeOdds, match.awayOdds]);

  // ── STEP 2: Adjustments ──

  // a) Injury impact
  const homeInj = match.homeInjuries ?? [];
  const awayInj = match.awayInjuries ?? [];
  const homeInjAdj = injuryAdj(homeInj);
  const awayInjAdj = injuryAdj(awayInj);
  const netInjuryAdj = clamp(homeInjAdj - awayInjAdj, -0.12, 0.12);

  // b) Back-to-back
  const homeB2B = match.homeOnBackToBack ?? false;
  const awayB2B = match.awayOnBackToBack ?? false;
  const netB2BAdj = clamp(
    (homeB2B ? -0.035 : 0) + (awayB2B ? 0.035 : 0),
    -0.035, 0.035
  );

  // c) Recent form vs season baseline (last 10)
  const homeL10 = match.homeRecentForm ?? match.homeForm ?? [];
  const awayL10 = match.awayRecentForm ?? match.awayForm ?? [];
  // Guard: if NEITHER team has form data, emit 0 — don't create spurious edge from
  // market-odds fallback being used as a season win-pct proxy.
  const hasFormData = homeL10.length > 0 || awayL10.length > 0;
  const homeFormRate = homeL10.filter(r => r === "W").length / Math.max(homeL10.length, 1);
  const awayFormRate = awayL10.filter(r => r === "W").length / Math.max(awayL10.length, 1);
  const homeSeasonWinPct = match.homeRecord?.winPct ?? marketHome;
  const awaySeasonWinPct = match.awayRecord?.winPct ?? marketAway;
  const netFormAdj = hasFormData ? clamp(
    ((homeFormRate - homeSeasonWinPct) - (awayFormRate - awaySeasonWinPct)) * 0.15,
    -0.08, 0.08
  ) : 0;

  // d) Home court boost
  const homeWinPct = match.homeRecord?.winPct ?? 0;
  const homeHomeWinPct = match.homeRecord?.homeWinPct ?? 0;
  const homeCourtBoost = homeHomeWinPct > homeWinPct + 0.05 ? 0.015 : 0.005;

  // ── STEP 3: Model probability ──
  const totalAdj = netInjuryAdj + netB2BAdj + netFormAdj + homeCourtBoost;
  const modelHome = clamp(marketHome + totalAdj, 0.05, 0.95);
  const modelAway = 1 - modelHome;

  // ── STEP 4: Edge ──
  const edgeHome = modelHome - marketHome;
  const edgeAway = modelAway - marketAway;

  // ── STEP 5: Odds range filter (fixes "Brooklyn at 6.3 = hot pick" bug) ──
  const NBA_MIN_ODDS = 1.25;
  const NBA_MAX_ODDS = 4.50;
  const homeOddsInRange = match.homeOdds >= NBA_MIN_ODDS && match.homeOdds <= NBA_MAX_ODDS;
  const awayOddsInRange = match.awayOdds >= NBA_MIN_ODDS && match.awayOdds <= NBA_MAX_ODDS;

  // ── STEP 6: Build factor labels ──
  const homeFactors: string[] = [
    ...injuryLabel(homeInj),
    homeB2B ? `😴 ${match.homeTeam} on back-to-back (-3.5%)` : "",
    homeL10.length >= 5 && Math.abs(homeFormRate - homeSeasonWinPct) > 0.1
      ? `📈 ${match.homeTeam} L${homeL10.length}: ${homeL10.filter(r=>r==="W").length}W-${homeL10.filter(r=>r==="L").length}L`
      : "",
    match.homeRecord ? `📊 ${match.homeTeam} season: ${match.homeRecord.wins}W-${match.homeRecord.losses}L` : "",
  ].filter(Boolean);

  const awayFactors: string[] = [
    ...injuryLabel(awayInj),
    awayB2B ? `😴 ${match.awayTeam} on back-to-back (-3.5%)` : "",
    awayL10.length >= 5 && Math.abs(awayFormRate - awaySeasonWinPct) > 0.1
      ? `📉 ${match.awayTeam} L${awayL10.length}: ${awayL10.filter(r=>r==="W").length}W-${awayL10.filter(r=>r==="L").length}L`
      : "",
    match.awayRecord ? `📊 ${match.awayTeam} season: ${match.awayRecord.wins}W-${match.awayRecord.losses}L` : "",
  ].filter(Boolean);

  const kellyHome = quarterKelly(modelHome, match.homeOdds);
  const kellyAway = quarterKelly(modelAway, match.awayOdds);

  // ── 1. Home Moneyline ──
  suggestions.push({
    market: "Moneyline",
    pick: `${match.homeTeam} Win`,
    confidence: Math.round(modelHome * 100),
    edge: edgeHome,
    modelProb: modelHome,
    marketProb: marketHome,
    odds: match.homeOdds,
    value: Math.abs(edgeHome) >= 0.05 && homeOddsInRange && kellyHome > 0.02,
    tier: edgeTier(edgeHome),
    reasoning: [
      `Market: ${Math.round(marketHome * 100)}% → Model: ${Math.round(modelHome * 100)}% (${edgeHome >= 0 ? "+" : ""}${(edgeHome * 100).toFixed(1)}% edge).`,
      homeFactors.slice(0, 2).join(" "),
    ].filter(Boolean).join(" "),
    kellySuggestion: formatKelly(modelHome, match.homeOdds),
    factors: [
      { label: "Injury delta", impact: clamp(netInjuryAdj * 5, -1, 1), direction: netInjuryAdj > 0.01 ? "+" : netInjuryAdj < -0.01 ? "-" : "=" },
      { label: "Back-to-back", impact: clamp(netB2BAdj * 10, -1, 1), direction: netB2BAdj > 0 ? "+" : netB2BAdj < 0 ? "-" : "=" },
      { label: "Recent form", impact: clamp(netFormAdj * 5, -1, 1), direction: netFormAdj > 0.01 ? "+" : netFormAdj < -0.01 ? "-" : "=" },
      { label: "Home court", impact: homeCourtBoost * 20, direction: "+" },
    ],
  });

  // ── 2. Away Moneyline ──
  suggestions.push({
    market: "Moneyline",
    pick: `${match.awayTeam} Win`,
    confidence: Math.round(modelAway * 100),
    edge: edgeAway,
    modelProb: modelAway,
    marketProb: marketAway,
    odds: match.awayOdds,
    value: Math.abs(edgeAway) >= 0.05 && awayOddsInRange && kellyAway > 0.02,
    tier: edgeTier(edgeAway),
    reasoning: [
      `Market: ${Math.round(marketAway * 100)}% → Model: ${Math.round(modelAway * 100)}% (${edgeAway >= 0 ? "+" : ""}${(edgeAway * 100).toFixed(1)}% edge).`,
      awayFactors.slice(0, 2).join(" "),
    ].filter(Boolean).join(" "),
    kellySuggestion: formatKelly(modelAway, match.awayOdds),
    factors: [
      { label: "Injury delta", impact: clamp(-netInjuryAdj * 5, -1, 1), direction: -netInjuryAdj > 0.01 ? "+" : -netInjuryAdj < -0.01 ? "-" : "=" },
      { label: "Back-to-back", impact: clamp(-netB2BAdj * 10, -1, 1), direction: -netB2BAdj > 0 ? "+" : -netB2BAdj < 0 ? "-" : "=" },
      { label: "Recent form", impact: clamp(-netFormAdj * 5, -1, 1), direction: -netFormAdj > 0.01 ? "+" : -netFormAdj < -0.01 ? "-" : "=" },
      { label: "Away disadvantage", impact: -0.1, direction: "-" },
    ],
  });

  // ── 3 & 4. Totals (use line from odds API if available) ──
  const ptsHome = match.goalsAvgHome || 112;
  const ptsAway = match.goalsAvgAway || 108;
  const combinedAvg = ptsHome + ptsAway;
  const line = match.totalLine ?? (combinedAvg - 3);
  const modelOver = clamp(combinedAvg > line + 2 ? 0.62 : combinedAvg > line ? 0.54 : 0.46);
  const edgeOver = modelOver - 0.50;
  suggestions.push({
    market: "Total Points",
    pick: `Over ${line.toFixed(0)}.5`,
    confidence: Math.round(modelOver * 100),
    edge: edgeOver,
    modelProb: modelOver,
    marketProb: 0.50,
    value: Math.abs(edgeOver) >= 0.05,
    tier: edgeTier(edgeOver),
    reasoning: `Combined pts avg: ${combinedAvg.toFixed(0)}/game vs line ${line.toFixed(0)}.`,
    kellySuggestion: formatKelly(modelOver, 1.90),
  });

  suggestions.push({
    market: "Total Points",
    pick: `Under ${line.toFixed(0)}.5`,
    confidence: Math.round((1 - modelOver) * 100),
    edge: (1 - modelOver) - 0.50,
    modelProb: 1 - modelOver,
    marketProb: 0.50,
    value: Math.abs((1 - modelOver) - 0.50) >= 0.05,
    tier: edgeTier((1 - modelOver) - 0.50),
    reasoning: `${Math.round((1 - modelOver) * 100)}% chance of staying under based on pace/defence.`,
    kellySuggestion: formatKelly(1 - modelOver, 1.90),
  });

  return suggestions.sort((a, b) => {
    if (a.value !== b.value) return a.value ? -1 : 1;
    return b.edge - a.edge;
  });
}

// ─── Unified entry point ─────────────────────────────────────────────────────

export function analyzeMatch(
  match: Parameters<typeof analyzeSoccer>[0] & Partial<NBAGameContext> & { sport: string }
): BetSuggestion[] {
  // GUARD: Only calculate edge when we have real market odds
  const hasRealOdds = !!(match.homeOdds && match.homeOdds > 1);
  if (!hasRealOdds) return [];

  if (match.sport === "nba") return analyzeNBA(match as NBAGameContext);
  return analyzeSoccer(match as Parameters<typeof analyzeSoccer>[0]);
}
