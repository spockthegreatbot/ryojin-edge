import type { RefereeStat } from "./referees";

export interface MatchData {
  id: string;
  sport: "soccer" | "nba";
  league: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  homeOdds: number;
  awayOdds: number;
  drawOdds?: number;
  homeForm: string[];
  awayForm: string[];
  h2hHomeWins: number;
  h2hTotal: number;
  h2hDraws: number;
  // Soccer-specific
  cornersAvgHome: number;
  cornersAvgAway: number;
  cardsAvgHome: number;
  cardsAvgAway: number;
  goalsAvgHome: number;
  goalsAvgAway: number;
  xgHome: number;
  xgAway: number;
  bttsProb: number;
  cleanSheetHome: number; // % chance home team keeps clean sheet
  cleanSheetAway: number;
  firstHalfGoalsAvg: number;
  varLikelihood: number; // %
  props: { label: string; value: string; confidence: number }[];
  // Algorithm v2 fields (optional — populated for live fixtures)
  homeElo?: number;
  awayElo?: number;
  referee?: string | null;
  refereeStats?: RefereeStat | null;
  // Feature v3 fields
  weather?: import("./weather").MatchWeather | null;
  homeTablePos?: number;
  awayTablePos?: number;
  dataSource?: "xG" | "goals_avg";
  // Best book odds
  bestOddsHome?: number;
  bestOddsHomeBook?: string;
  bestOddsAway?: number;
  bestOddsAwayBook?: string;
  bestOddsDraw?: number;
  bestOddsDrawBook?: string;
  allBookOdds?: { book: string; home: number; away: number; draw?: number }[];
}

const T = () => Date.now();

export const MOCK_MATCHES: MatchData[] = [
  {
    id: "epl-001",
    sport: "soccer",
    league: "Premier League",
    homeTeam: "Arsenal",
    awayTeam: "Man City",
    commenceTime: new Date(T() + 3600000).toISOString(),
    homeOdds: 2.4,
    awayOdds: 2.8,
    drawOdds: 3.2,
    homeForm: ["W", "W", "D", "W", "L"],
    awayForm: ["W", "W", "W", "D", "W"],
    h2hHomeWins: 2,
    h2hTotal: 5,
    h2hDraws: 1,
    cornersAvgHome: 5.8,
    cornersAvgAway: 6.2,
    cardsAvgHome: 1.8,
    cardsAvgAway: 2.1,
    goalsAvgHome: 2.1,
    goalsAvgAway: 2.4,
    xgHome: 1.9,
    xgAway: 2.2,
    bttsProb: 68,
    cleanSheetHome: 28,
    cleanSheetAway: 22,
    firstHalfGoalsAvg: 1.3,
    varLikelihood: 65,
    props: [
      { label: "Total Goals", value: "Over 2.5", confidence: 72 },
      { label: "Corners", value: "Over 10.5", confidence: 65 },
      { label: "BTTS", value: "Yes", confidence: 68 },
      { label: "Cards", value: "Over 3.5", confidence: 61 },
      { label: "1st Half Goals", value: "Over 1.5", confidence: 58 },
    ],
  },
  {
    id: "epl-002",
    sport: "soccer",
    league: "Premier League",
    homeTeam: "Liverpool",
    awayTeam: "Chelsea",
    commenceTime: new Date(T() + 7200000).toISOString(),
    homeOdds: 1.85,
    awayOdds: 4.2,
    drawOdds: 3.5,
    homeForm: ["W", "W", "W", "D", "W"],
    awayForm: ["L", "W", "D", "L", "W"],
    h2hHomeWins: 3,
    h2hTotal: 5,
    h2hDraws: 1,
    cornersAvgHome: 6.4,
    cornersAvgAway: 4.8,
    cardsAvgHome: 1.4,
    cardsAvgAway: 2.3,
    goalsAvgHome: 2.6,
    goalsAvgAway: 1.8,
    xgHome: 2.3,
    xgAway: 1.5,
    bttsProb: 55,
    cleanSheetHome: 35,
    cleanSheetAway: 18,
    firstHalfGoalsAvg: 1.6,
    varLikelihood: 52,
    props: [
      { label: "Total Goals", value: "Over 2.5", confidence: 78 },
      { label: "Cards", value: "Over 3.5", confidence: 62 },
      { label: "BTTS", value: "Yes", confidence: 55 },
      { label: "Corners", value: "Over 9.5", confidence: 70 },
      { label: "1st Half Goals", value: "Over 1.5", confidence: 64 },
    ],
  },
  {
    id: "epl-003",
    sport: "soccer",
    league: "Premier League",
    homeTeam: "Tottenham",
    awayTeam: "Aston Villa",
    commenceTime: new Date(T() + 10800000).toISOString(),
    homeOdds: 2.1,
    awayOdds: 3.4,
    drawOdds: 3.3,
    homeForm: ["D", "W", "L", "W", "D"],
    awayForm: ["W", "D", "W", "L", "W"],
    h2hHomeWins: 2,
    h2hTotal: 5,
    h2hDraws: 2,
    cornersAvgHome: 5.1,
    cornersAvgAway: 5.4,
    cardsAvgHome: 2.0,
    cardsAvgAway: 1.7,
    goalsAvgHome: 1.9,
    goalsAvgAway: 2.0,
    xgHome: 1.7,
    xgAway: 1.8,
    bttsProb: 60,
    cleanSheetHome: 24,
    cleanSheetAway: 26,
    firstHalfGoalsAvg: 1.0,
    varLikelihood: 44,
    props: [
      { label: "Total Goals", value: "Under 2.5", confidence: 55 },
      { label: "Cards", value: "Over 3.5", confidence: 58 },
      { label: "Corners", value: "Over 9.5", confidence: 61 },
      { label: "BTTS", value: "Yes", confidence: 60 },
      { label: "1st Half Goals", value: "Under 1.5", confidence: 62 },
    ],
  },
  {
    id: "epl-004",
    sport: "soccer",
    league: "Premier League",
    homeTeam: "Newcastle",
    awayTeam: "Man United",
    commenceTime: new Date(T() + 14400000).toISOString(),
    homeOdds: 2.0,
    awayOdds: 3.6,
    drawOdds: 3.4,
    homeForm: ["W", "D", "W", "W", "W"],
    awayForm: ["L", "L", "D", "W", "L"],
    h2hHomeWins: 3,
    h2hTotal: 5,
    h2hDraws: 1,
    cornersAvgHome: 5.5,
    cornersAvgAway: 4.2,
    cardsAvgHome: 1.6,
    cardsAvgAway: 2.5,
    goalsAvgHome: 1.8,
    goalsAvgAway: 1.4,
    xgHome: 1.6,
    xgAway: 1.2,
    bttsProb: 48,
    cleanSheetHome: 38,
    cleanSheetAway: 20,
    firstHalfGoalsAvg: 0.9,
    varLikelihood: 58,
    props: [
      { label: "Total Goals", value: "Under 2.5", confidence: 60 },
      { label: "Cards", value: "Over 4.5", confidence: 70 },
      { label: "BTTS", value: "No", confidence: 52 },
      { label: "Corners", value: "Over 8.5", confidence: 65 },
      { label: "1st Half Goals", value: "Under 1.5", confidence: 68 },
    ],
  },
  {
    id: "ucl-001",
    sport: "soccer",
    league: "Champions League",
    homeTeam: "Real Madrid",
    awayTeam: "Bayern Munich",
    commenceTime: new Date(T() + 18000000).toISOString(),
    homeOdds: 2.05,
    awayOdds: 3.4,
    drawOdds: 3.5,
    homeForm: ["W", "W", "W", "W", "D"],
    awayForm: ["W", "W", "D", "W", "W"],
    h2hHomeWins: 3,
    h2hTotal: 6,
    h2hDraws: 1,
    cornersAvgHome: 6.2,
    cornersAvgAway: 5.8,
    cardsAvgHome: 1.5,
    cardsAvgAway: 1.9,
    goalsAvgHome: 2.4,
    goalsAvgAway: 2.6,
    xgHome: 2.1,
    xgAway: 2.3,
    bttsProb: 72,
    cleanSheetHome: 30,
    cleanSheetAway: 25,
    firstHalfGoalsAvg: 1.5,
    varLikelihood: 70,
    props: [
      { label: "Total Goals", value: "Over 2.5", confidence: 80 },
      { label: "BTTS", value: "Yes", confidence: 72 },
      { label: "Corners", value: "Over 10.5", confidence: 68 },
      { label: "1st Half Goals", value: "Over 1.5", confidence: 65 },
      { label: "Cards", value: "Over 3.5", confidence: 60 },
    ],
  },
  {
    id: "nba-001",
    sport: "nba",
    league: "NBA",
    homeTeam: "LA Lakers",
    awayTeam: "Boston Celtics",
    commenceTime: new Date(T() + 21600000).toISOString(),
    homeOdds: 1.95,
    awayOdds: 1.85,
    homeForm: ["W", "L", "W", "W", "L"],
    awayForm: ["W", "W", "W", "W", "W"],
    h2hHomeWins: 2,
    h2hTotal: 5,
    h2hDraws: 0,
    cornersAvgHome: 0,
    cornersAvgAway: 0,
    cardsAvgHome: 0,
    cardsAvgAway: 0,
    goalsAvgHome: 115.2,
    goalsAvgAway: 118.4,
    xgHome: 0,
    xgAway: 0,
    bttsProb: 0,
    cleanSheetHome: 0,
    cleanSheetAway: 0,
    firstHalfGoalsAvg: 0,
    varLikelihood: 0,
    props: [
      { label: "Total Points", value: "Over 225.5", confidence: 70 },
      { label: "Spread", value: "Celtics -1.5", confidence: 62 },
      { label: "First Half", value: "Over 110.5", confidence: 67 },
      { label: "Player Prop", value: "LeBron 25+ pts", confidence: 61 },
    ],
  },
  {
    id: "nba-002",
    sport: "nba",
    league: "NBA",
    homeTeam: "Golden State",
    awayTeam: "Miami Heat",
    commenceTime: new Date(T() + 25200000).toISOString(),
    homeOdds: 1.75,
    awayOdds: 2.1,
    homeForm: ["W", "W", "W", "L", "W"],
    awayForm: ["L", "L", "W", "L", "L"],
    h2hHomeWins: 4,
    h2hTotal: 5,
    h2hDraws: 0,
    cornersAvgHome: 0,
    cornersAvgAway: 0,
    cardsAvgHome: 0,
    cardsAvgAway: 0,
    goalsAvgHome: 121.0,
    goalsAvgAway: 109.5,
    xgHome: 0,
    xgAway: 0,
    bttsProb: 0,
    cleanSheetHome: 0,
    cleanSheetAway: 0,
    firstHalfGoalsAvg: 0,
    varLikelihood: 0,
    props: [
      { label: "Total Points", value: "Under 228.5", confidence: 65 },
      { label: "Spread", value: "Warriors -4.5", confidence: 74 },
      { label: "Player Prop", value: "Curry 30+ pts", confidence: 58 },
      { label: "First Half", value: "Warriors -2.5", confidence: 67 },
    ],
  },
];
