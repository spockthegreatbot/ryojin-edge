export interface MatchData {
  id: string;
  sport: "soccer" | "nba";
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
  cornersAvgHome: number;
  cornersAvgAway: number;
  cardsAvgHome: number;
  cardsAvgAway: number;
  goalsAvgHome: number;
  goalsAvgAway: number;
  xgHome: number;
  xgAway: number;
  bttsProb: number;
  props: { label: string; value: string; confidence: number }[];
}

const T = () => Date.now();

export const MOCK_MATCHES: MatchData[] = [
  {
    id: "epl-001", sport: "soccer", homeTeam: "Arsenal", awayTeam: "Man City",
    commenceTime: new Date(T() + 3600000).toISOString(),
    homeOdds: 2.4, awayOdds: 2.8, drawOdds: 3.2,
    homeForm: ["W","W","D","W","L"], awayForm: ["W","W","W","D","W"],
    h2hHomeWins: 2, h2hTotal: 5,
    cornersAvgHome: 5.8, cornersAvgAway: 6.2, cardsAvgHome: 1.8, cardsAvgAway: 2.1,
    goalsAvgHome: 2.1, goalsAvgAway: 2.4, xgHome: 1.9, xgAway: 2.2, bttsProb: 68,
    props: [
      { label: "Total Goals", value: "Over 2.5", confidence: 72 },
      { label: "Corners", value: "Over 10.5", confidence: 65 },
      { label: "BTTS", value: "Yes", confidence: 68 }
    ]
  },
  {
    id: "epl-002", sport: "soccer", homeTeam: "Liverpool", awayTeam: "Chelsea",
    commenceTime: new Date(T() + 7200000).toISOString(),
    homeOdds: 1.85, awayOdds: 4.2, drawOdds: 3.5,
    homeForm: ["W","W","W","D","W"], awayForm: ["L","W","D","L","W"],
    h2hHomeWins: 3, h2hTotal: 5,
    cornersAvgHome: 6.4, cornersAvgAway: 4.8, cardsAvgHome: 1.4, cardsAvgAway: 2.3,
    goalsAvgHome: 2.6, goalsAvgAway: 1.8, xgHome: 2.3, xgAway: 1.5, bttsProb: 55,
    props: [
      { label: "Total Goals", value: "Over 2.5", confidence: 78 },
      { label: "Cards", value: "Over 3.5", confidence: 62 },
      { label: "BTTS", value: "Yes", confidence: 55 }
    ]
  },
  {
    id: "epl-003", sport: "soccer", homeTeam: "Tottenham", awayTeam: "Aston Villa",
    commenceTime: new Date(T() + 10800000).toISOString(),
    homeOdds: 2.1, awayOdds: 3.4, drawOdds: 3.3,
    homeForm: ["D","W","L","W","D"], awayForm: ["W","D","W","L","W"],
    h2hHomeWins: 2, h2hTotal: 5,
    cornersAvgHome: 5.1, cornersAvgAway: 5.4, cardsAvgHome: 2.0, cardsAvgAway: 1.7,
    goalsAvgHome: 1.9, goalsAvgAway: 2.0, xgHome: 1.7, xgAway: 1.8, bttsProb: 60,
    props: [
      { label: "Total Goals", value: "Under 2.5", confidence: 55 },
      { label: "Cards", value: "Over 3.5", confidence: 58 },
      { label: "Corners", value: "Over 9.5", confidence: 61 }
    ]
  },
  {
    id: "epl-004", sport: "soccer", homeTeam: "Newcastle", awayTeam: "Man United",
    commenceTime: new Date(T() + 14400000).toISOString(),
    homeOdds: 2.0, awayOdds: 3.6, drawOdds: 3.4,
    homeForm: ["W","D","W","W","W"], awayForm: ["L","L","D","W","L"],
    h2hHomeWins: 3, h2hTotal: 5,
    cornersAvgHome: 5.5, cornersAvgAway: 4.2, cardsAvgHome: 1.6, cardsAvgAway: 2.5,
    goalsAvgHome: 1.8, goalsAvgAway: 1.4, xgHome: 1.6, xgAway: 1.2, bttsProb: 48,
    props: [
      { label: "Total Goals", value: "Under 2.5", confidence: 60 },
      { label: "Cards", value: "Over 4.5", confidence: 70 },
      { label: "BTTS", value: "No", confidence: 52 }
    ]
  },
  {
    id: "nba-001", sport: "nba", homeTeam: "LA Lakers", awayTeam: "Boston Celtics",
    commenceTime: new Date(T() + 18000000).toISOString(),
    homeOdds: 1.95, awayOdds: 1.85,
    homeForm: ["W","L","W","W","L"], awayForm: ["W","W","W","W","W"],
    h2hHomeWins: 2, h2hTotal: 5,
    cornersAvgHome: 0, cornersAvgAway: 0, cardsAvgHome: 0, cardsAvgAway: 0,
    goalsAvgHome: 115.2, goalsAvgAway: 118.4, xgHome: 0, xgAway: 0, bttsProb: 0,
    props: [
      { label: "Total Points", value: "Over 225.5", confidence: 70 },
      { label: "Spread", value: "Celtics -1.5", confidence: 62 },
      { label: "First Half", value: "Over 110.5", confidence: 67 }
    ]
  },
  {
    id: "nba-002", sport: "nba", homeTeam: "Golden State", awayTeam: "Miami Heat",
    commenceTime: new Date(T() + 21600000).toISOString(),
    homeOdds: 1.75, awayOdds: 2.1,
    homeForm: ["W","W","W","L","W"], awayForm: ["L","L","W","L","L"],
    h2hHomeWins: 4, h2hTotal: 5,
    cornersAvgHome: 0, cornersAvgAway: 0, cardsAvgHome: 0, cardsAvgAway: 0,
    goalsAvgHome: 121.0, goalsAvgAway: 109.5, xgHome: 0, xgAway: 0, bttsProb: 0,
    props: [
      { label: "Total Points", value: "Under 228.5", confidence: 65 },
      { label: "Spread", value: "Warriors -4.5", confidence: 74 },
      { label: "Player Prop", value: "Curry 30+ pts", confidence: 58 }
    ]
  }
];
