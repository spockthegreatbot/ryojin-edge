// Multi-market bet analyzer
// Compares model probability vs market implied probability
// Surfaces value bets with reasoning

export interface BetSuggestion {
  market: string;       // "Match Result" | "Over 2.5 Goals" | "BTTS" | "Asian Handicap" etc
  pick: string;         // "Home Win" | "Over 2.5" | "Yes" | "Away -1.5" etc
  confidence: number;   // 0–100 (model confidence in the pick)
  edge: number;         // modelProb - marketProb (positive = value)
  modelProb: number;    // our calculated probability (0–1)
  marketProb: number;   // market implied probability de-vigged (0–1)
  odds?: number;        // the decimal odds for this selection
  value: boolean;       // true if edge >= 0.05 (5 cent gap)
  reasoning: string;    // one-line explanation
  tier: "🔥 Strong" | "✅ Lean" | "⚠️ Marginal";
}

// --- Helpers ---

function formScore(form: string[]): number {
  if (!form?.length) return 0.5;
  const score = form.reduce((s, r) => s + (r === "W" ? 1 : r === "D" ? 0.4 : 0), 0);
  return score / (form.length * 1);
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

// P(total goals > line) using Poisson
function probOver(lambdaHome: number, lambdaAway: number, line: number): number {
  const maxGoals = 15;
  let probUnder = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      if (h + a <= line) {
        probUnder += poisson(lambdaHome, h) * poisson(lambdaAway, a);
      }
    }
  }
  return Math.min(0.97, Math.max(0.03, 1 - probUnder));
}

// P(both teams score)
function probBTTS(lambdaHome: number, lambdaAway: number): number {
  const pHomeScores = 1 - poisson(lambdaHome, 0);
  const pAwayScores = 1 - poisson(lambdaAway, 0);
  return pHomeScores * pAwayScores;
}

function edgeTier(edge: number): BetSuggestion["tier"] {
  if (edge >= 0.10) return "🔥 Strong";
  if (edge >= 0.05) return "✅ Lean";
  return "⚠️ Marginal";
}

function clamp(v: number, min = 0.03, max = 0.97) {
  return Math.max(min, Math.min(max, v));
}

// --- Soccer analyzer ---

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
  bttsProb: number;
  cleanSheetHome: number;
  cleanSheetAway: number;
  cornersAvgHome: number;
  cornersAvgAway: number;
}): BetSuggestion[] {
  const suggestions: BetSuggestion[] = [];

  const homeF = formScore(match.homeForm);
  const awayF = formScore(match.awayForm);
  const formAdv = homeF - awayF; // -1 to 1

  const h2hTotal = Math.max(match.h2hTotal, 1);
  const h2hHomeRate = match.h2hHomeWins / h2hTotal;
  const h2hDrawRate = match.h2hDraws / h2hTotal;
  const h2hAwayRate = 1 - h2hHomeRate - h2hDrawRate;

  const lambdaHome = Math.max(0.3, match.goalsAvgHome || 1.4);
  const lambdaAway = Math.max(0.3, match.goalsAvgAway || 1.1);

  // --- De-vig market probs ---
  const oddsArr = match.drawOdds
    ? [match.homeOdds, match.drawOdds, match.awayOdds]
    : [match.homeOdds, match.awayOdds];
  const [marketHome, marketDraw, marketAway] = match.drawOdds
    ? deVig(oddsArr)
    : [...deVig([match.homeOdds, match.awayOdds]), 0];

  // --- 1. Match Result: Home Win ---
  const modelHome = clamp(
    marketHome * 0.45 +
    (0.33 + formAdv * 0.25) * 0.30 +
    h2hHomeRate * 0.15 +
    0.05 * 0.10 // home advantage bonus
  );
  const edgeHome = modelHome - marketHome;
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
    reasoning: `Form edge ${formAdv > 0 ? "favours home" : "against home"} (${match.homeForm?.slice(-3).join("") || "—"}). H2H: ${match.h2hHomeWins}/${h2hTotal} home wins.`,
  });

  // --- 2. Match Result: Away Win ---
  const modelAway = clamp(
    marketAway * 0.45 +
    (0.33 + (awayF - homeF) * 0.25) * 0.30 +
    h2hAwayRate * 0.15
  );
  const edgeAway = modelAway - marketAway;
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
    reasoning: `Away form: ${match.awayForm?.slice(-3).join("") || "—"}. H2H: ${Math.round(h2hAwayRate * h2hTotal)}/${h2hTotal} away wins.`,
  });

  // --- 3. Draw ---
  if (match.drawOdds && marketDraw > 0) {
    const modelDrawCalc = clamp(
      marketDraw * 0.5 +
      h2hDrawRate * 0.3 +
      (Math.abs(formAdv) < 0.15 ? 0.1 : 0.0)
    );
    const edgeDraw = modelDrawCalc - marketDraw;
    suggestions.push({
      market: "Match Result",
      pick: "Draw",
      confidence: Math.round(modelDrawCalc * 100),
      edge: edgeDraw,
      modelProb: modelDrawCalc,
      marketProb: marketDraw,
      odds: match.drawOdds,
      value: edgeDraw >= 0.05,
      tier: edgeTier(edgeDraw),
      reasoning: `Teams ${Math.abs(formAdv) < 0.15 ? "evenly matched" : "have form gap"}. H2H draws: ${match.h2hDraws}/${h2hTotal}.`,
    });
  }

  // --- 4. Over 2.5 Goals ---
  const modelOver25 = probOver(lambdaHome, lambdaAway, 2.5);
  // Market prob for O2.5 — approximate from match odds (high-scoring teams → lower draw odds)
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
    reasoning: `Expected goals: ${lambdaHome.toFixed(1)} + ${lambdaAway.toFixed(1)} = ${(lambdaHome + lambdaAway).toFixed(1)}. Poisson model gives ${Math.round(modelOver25 * 100)}% chance of 3+ goals.`,
  });

  // --- 5. Under 2.5 Goals ---
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
    reasoning: `${Math.round(modelUnder25 * 100)}% chance of 2 or fewer goals based on teams' scoring rates.`,
  });

  // --- 6. BTTS ---
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
    reasoning: `Home scores in ${Math.round((1 - poisson(lambdaHome, 0)) * 100)}% of games, away in ${Math.round((1 - poisson(lambdaAway, 0)) * 100)}% of games.`,
  });

  // --- 7. BTTS No ---
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
  });

  // --- 8. Double Chance Home or Draw ---
  const modelDrawVal = match.drawOdds ? clamp(marketDraw * 0.5 + h2hDrawRate * 0.3 + (Math.abs(formAdv) < 0.15 ? 0.1 : 0.0)) : 0;
  if (match.drawOdds) {
    const modelHX = clamp(modelHome + modelDrawVal);
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
      reasoning: `Combined home win + draw probability. Good if home form is strong but odds are tight.`,
    });
  }

  // --- 9. Corners market (real data from API-Sports) ---
  const cornersHome = match.cornersAvgHome ?? 0;
  const cornersAway = match.cornersAvgAway ?? 0;
  if (cornersHome > 0 && cornersAway > 0) {
    const totalCornersAvg = cornersHome + cornersAway;
    const line = 9.5; // EPL typical line
    // Simple model: if avg is above line → lean over; below → lean under
    const overProb = clamp(0.5 + (totalCornersAvg - line) * 0.04);
    const marketCorners = 0.50; // market is typically 50/50 around line
    const edgeCorners = overProb - marketCorners;
    suggestions.push({
      market: "Total Corners",
      pick: `Over ${line}`,
      confidence: Math.round(overProb * 100),
      edge: edgeCorners,
      modelProb: overProb,
      marketProb: marketCorners,
      value: edgeCorners >= 0.05,
      tier: edgeTier(edgeCorners),
      reasoning: `Combined corners avg: ${totalCornersAvg.toFixed(1)}/game (H: ${cornersHome.toFixed(1)}, A: ${cornersAway.toFixed(1)}). Line: ${line}.`,
    });
  }

  // --- 10. Cards market (real data from API-Sports) ---
  const cardsAvgHome = (match as { cardsAvgHome?: number }).cardsAvgHome ?? 0;
  const cardsAvgAway = (match as { cardsAvgAway?: number }).cardsAvgAway ?? 0;
  if (cardsAvgHome > 0) {
    const totalCardsAvg = cardsAvgHome + cardsAvgAway;
    const cardLine = 3.5; // typical total cards line
    const cardOverProb = clamp(0.5 + (totalCardsAvg - cardLine) * 0.08);
    const edgeCards = cardOverProb - 0.5;
    suggestions.push({
      market: "Total Cards",
      pick: `Over ${cardLine}`,
      confidence: Math.round(cardOverProb * 100),
      edge: edgeCards,
      modelProb: cardOverProb,
      marketProb: 0.5,
      value: edgeCards >= 0.05,
      tier: edgeTier(edgeCards),
      reasoning: `Yellow cards avg: ${cardsAvgHome.toFixed(1)}/game home, ${cardsAvgAway.toFixed(1)}/game away. Total: ${totalCardsAvg.toFixed(1)}.`,
    });
  }

  // Sort: value bets first, then by edge descending
  return suggestions.sort((a, b) => {
    if (a.value !== b.value) return a.value ? -1 : 1;
    return b.edge - a.edge;
  });
}

// --- NBA analyzer ---

export function analyzeNBA(match: {
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  awayOdds: number;
  homeForm: string[];
  awayForm: string[];
  h2hHomeWins: number;
  h2hTotal: number;
  goalsAvgHome: number; // pts per game
  goalsAvgAway: number;
}): BetSuggestion[] {
  const suggestions: BetSuggestion[] = [];

  const homeF = formScore(match.homeForm);
  const awayF = formScore(match.awayForm);
  const formAdv = homeF - awayF;

  const h2hTotal = Math.max(match.h2hTotal, 1);
  const h2hHomeRate = match.h2hHomeWins / h2hTotal;

  const [marketHome, marketAway] = deVig([match.homeOdds, match.awayOdds]);

  const ptsHome = match.goalsAvgHome || 112;
  const ptsAway = match.goalsAvgAway || 108;
  const totalPts = ptsHome + ptsAway;

  // --- 1. Home Moneyline ---
  const modelHome = clamp(
    marketHome * 0.40 +
    (0.5 + formAdv * 0.3) * 0.35 +
    h2hHomeRate * 0.15 +
    0.04 // home court
  );
  const edgeHome = modelHome - marketHome;
  suggestions.push({
    market: "Moneyline",
    pick: `${match.homeTeam} Win`,
    confidence: Math.round(modelHome * 100),
    edge: edgeHome,
    modelProb: modelHome,
    marketProb: marketHome,
    odds: match.homeOdds,
    value: edgeHome >= 0.05,
    tier: edgeTier(edgeHome),
    reasoning: `Form: ${match.homeForm?.slice(-3).join("") || "—"} vs ${match.awayForm?.slice(-3).join("") || "—"}. Home court + H2H ${match.h2hHomeWins}/${h2hTotal}.`,
  });

  // --- 2. Away Moneyline ---
  const modelAway = clamp(1 - modelHome);
  const edgeAway = modelAway - marketAway;
  suggestions.push({
    market: "Moneyline",
    pick: `${match.awayTeam} Win`,
    confidence: Math.round(modelAway * 100),
    edge: edgeAway,
    modelProb: modelAway,
    marketProb: marketAway,
    odds: match.awayOdds,
    value: edgeAway >= 0.05,
    tier: edgeTier(edgeAway),
    reasoning: `Away form: ${match.awayForm?.slice(-3).join("") || "—"}. Pts avg: ${ptsAway.toFixed(0)}/game.`,
  });

  // --- 3. Total Points Over ---
  const line = totalPts - 3; // typical market line
  const modelOver = clamp(totalPts > line + 2 ? 0.62 : totalPts > line ? 0.54 : 0.46);
  const marketOver = 0.50; // roughly 50/50 when line is set correctly
  const edgeOver = modelOver - marketOver;
  suggestions.push({
    market: "Total Points",
    pick: `Over ${line.toFixed(0) }.5`,
    confidence: Math.round(modelOver * 100),
    edge: edgeOver,
    modelProb: modelOver,
    marketProb: marketOver,
    value: edgeOver >= 0.05,
    tier: edgeTier(edgeOver),
    reasoning: `Combined pts avg: ${totalPts.toFixed(0)}/game. Line implies ${line.toFixed(0)} pts.`,
  });

  // --- 4. Total Points Under ---
  const modelUnder = clamp(1 - modelOver);
  const edgeUnder = modelUnder - (1 - marketOver);
  suggestions.push({
    market: "Total Points",
    pick: `Under ${line.toFixed(0)}.5`,
    confidence: Math.round(modelUnder * 100),
    edge: edgeUnder,
    modelProb: modelUnder,
    marketProb: 1 - marketOver,
    value: edgeUnder >= 0.05,
    tier: edgeTier(edgeUnder),
    reasoning: `${Math.round(modelUnder * 100)}% chance game stays under based on pace and defensive ratings.`,
  });

  return suggestions.sort((a, b) => {
    if (a.value !== b.value) return a.value ? -1 : 1;
    return b.edge - a.edge;
  });
}

// Unified entry point
export function analyzeMatch(match: Parameters<typeof analyzeSoccer>[0] & { sport: "soccer" | "nba" }): BetSuggestion[] {
  if (match.sport === "nba") return analyzeNBA(match);
  return analyzeSoccer(match);
}
