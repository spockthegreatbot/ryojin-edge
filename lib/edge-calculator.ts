export interface ReasoningItem {
  label: string;
  detail: string;
  impact: "positive" | "neutral" | "negative";
}

export interface EdgeResult {
  score: number;
  color: "red" | "yellow" | "green";
  reasoning: ReasoningItem[];
}

export interface PropReasoning {
  prop: string;
  value: string;
  confidence: number;
  why: string[];
}

export function calcEdgeScore(p: {
  homeForm: string[];
  awayForm: string[];
  h2hHomeWins: number;
  h2hTotal: number;
  homeTeam: string;
  awayTeam: string;
}): EdgeResult {
  const fs = (f: string[]) =>
    f.reduce((a, r) => a + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);

  const homeFormPts = fs(p.homeForm);
  const awayFormPts = fs(p.awayForm);
  const homeFormScore = (homeFormPts / 15) * 40;
  const awayFormScore = (awayFormPts / 15) * 15;
  const h2hRatio = p.h2hTotal > 0 ? p.h2hHomeWins / p.h2hTotal : 0.5;
  const h2hBonus = h2hRatio > 0.6 ? 10 : 0;

  const score = Math.min(100, Math.max(0, Math.round(30 + homeFormScore - awayFormScore + h2hBonus)));
  const color: "red" | "yellow" | "green" = score < 40 ? "red" : score < 65 ? "yellow" : "green";

  const homeFormStr = p.homeForm.join(" ");
  const awayFormStr = p.awayForm.join(" ");

  const reasoning: ReasoningItem[] = [
    {
      label: `${p.homeTeam} Form`,
      detail: `Last 5: ${homeFormStr} — ${homeFormPts}/15 form points. ${
        homeFormPts >= 10 ? "Strong recent run." : homeFormPts >= 6 ? "Inconsistent form." : "Poor recent form."
      }`,
      impact: homeFormPts >= 10 ? "positive" : homeFormPts >= 6 ? "neutral" : "negative",
    },
    {
      label: `${p.awayTeam} Form`,
      detail: `Last 5: ${awayFormStr} — ${awayFormPts}/15 form points. ${
        awayFormPts >= 10 ? "In-form visitors are a threat." : awayFormPts >= 6 ? "Visitors inconsistent." : "Visitors in poor form."
      }`,
      impact: awayFormPts >= 10 ? "negative" : awayFormPts >= 6 ? "neutral" : "positive",
    },
    {
      label: "Head to Head",
      detail: `${p.homeTeam} won ${p.h2hHomeWins} of ${p.h2hTotal} meetings (${Math.round(h2hRatio * 100)}%). ${
        h2hBonus > 0
          ? "Strong historical dominance at home — +10 edge pts."
          : "No significant H2H home advantage."
      }`,
      impact: h2hBonus > 0 ? "positive" : "neutral",
    },
  ];

  return { score, color, reasoning };
}

export function buildPropReasoning(m: {
  homeTeam: string;
  awayTeam: string;
  sport: string;
  goalsAvgHome: number;
  goalsAvgAway: number;
  xgHome: number;
  xgAway: number;
  cornersAvgHome: number;
  cornersAvgAway: number;
  cardsAvgHome: number;
  cardsAvgAway: number;
  bttsProb: number;
  homeForm: string[];
  awayForm: string[];
  h2hHomeWins: number;
  h2hTotal: number;
  props: { label: string; value: string; confidence: number }[];
}): PropReasoning[] {
  const totalGoals = m.goalsAvgHome + m.goalsAvgAway;
  const totalCorners = m.cornersAvgHome + m.cornersAvgAway;
  const totalCards = m.cardsAvgHome + m.cardsAvgAway;
  const totalXg = m.xgHome + m.xgAway;

  if (m.sport === "soccer") {
    return [
      {
        prop: "Total Goals",
        value: totalGoals >= 2.5 ? "Over 2.5" : "Under 2.5",
        confidence: m.props.find((p) => p.label === "Total Goals")?.confidence ?? 60,
        why: [
          `${m.homeTeam} avg ${m.goalsAvgHome} goals/game at home, ${m.awayTeam} avg ${m.goalsAvgAway} away — combined output ${totalGoals.toFixed(1)}/game.`,
          `xG totals: ${m.xgHome} (home) + ${m.xgAway} (away) = ${totalXg.toFixed(1)} expected goals — ${totalXg >= 2.5 ? "above" : "below"} the 2.5 line.`,
          totalGoals >= 2.5
            ? "Both teams create enough chances to expect goals in both halves."
            : "Defensive shape likely to keep this tight — expect fewer than 3 goals.",
        ],
      },
      {
        prop: "Corners",
        value: `Over ${(totalCorners - 1).toFixed(0)}.5`,
        confidence: m.props.find((p) => p.label === "Corners")?.confidence ?? 58,
        why: [
          `${m.homeTeam} avg ${m.cornersAvgHome} corners at home, ${m.awayTeam} avg ${m.cornersAvgAway} away — total ${totalCorners.toFixed(1)}/game.`,
          "Corner counts correlate strongly with team attacking width and set-piece reliance.",
          totalCorners >= 10
            ? "High-pressure game expected — both sides likely to force corner situations in wide areas."
            : "Low corner count suggests central play or defensive positioning.",
        ],
      },
      {
        prop: "Total Cards",
        value: `Over ${Math.floor(totalCards)}.5`,
        confidence: m.props.find((p) => p.label === "Cards")?.confidence ?? 56,
        why: [
          `${m.homeTeam} avg ${m.cardsAvgHome} cards at home, ${m.awayTeam} avg ${m.cardsAvgAway} away — total ${totalCards.toFixed(1)}/game.`,
          totalCards >= 3.5
            ? "Both squads show disciplinary issues — referee likely to be busy."
            : "Generally disciplined sides — don't expect a card-fest.",
          "Rivalry intensity and referee profile also influence this market significantly.",
        ],
      },
      {
        prop: "BTTS (Both Teams Score)",
        value: m.bttsProb >= 55 ? "Yes" : "No",
        confidence: m.bttsProb,
        why: [
          `Historical BTTS probability for this fixture: ${m.bttsProb}% based on last 10 meetings.`,
          `${m.homeTeam} xG ${m.xgHome} vs ${m.awayTeam} xG ${m.xgAway} — ${
            m.xgHome >= 1.2 && m.xgAway >= 1.2
              ? "both sides generating genuine goal-scoring chances."
              : "one side likely to be shut out."
          }`,
          m.bttsProb >= 60
            ? "Neither defence is clean enough to prevent the other team scoring."
            : "Expect one clean sheet — defensive form backs a shutout.",
        ],
      },
      {
        prop: "VAR Intervention",
        value: totalCards >= 3.5 || totalGoals >= 2.8 ? "Likely" : "Unlikely",
        confidence: totalCards >= 3.5 ? 62 : 38,
        why: [
          "VAR interventions are more likely in high-card, high-stakes matches.",
          totalCards >= 3.5
            ? `${totalCards.toFixed(1)} avg cards/game suggests contentious challenges — VAR likely to be called.`
            : "Low card average suggests a cleaner game — VAR less likely to be needed.",
          "Penalty decisions and offside calls are the most common VAR triggers — watch for high-press play.",
        ],
      },
    ];
  }

  // NBA
  return [
    {
      prop: "Total Points",
      value: totalGoals >= 220 ? `Over ${Math.round(totalGoals) - 5}.5` : `Under ${Math.round(totalGoals) + 5}.5`,
      confidence: m.props.find((p) => p.label === "Total Points")?.confidence ?? 65,
      why: [
        `${m.homeTeam} avg ${m.goalsAvgHome} pts/game at home, ${m.awayTeam} avg ${m.goalsAvgAway} away — combined ${totalGoals.toFixed(1)}/game.`,
        "Pace of play and defensive rating are the key drivers for totals.",
        totalGoals >= 220
          ? "Up-tempo offenses from both sides — expect scoring in the 220s+."
          : "Defensive-minded teams — likely to be a grind-it-out game.",
      ],
    },
    {
      prop: "Spread",
      value: m.props.find((p) => p.label === "Spread")?.value ?? "Pick'em",
      confidence: m.props.find((p) => p.label === "Spread")?.confidence ?? 60,
      why: [
        `${m.homeTeam} home record and recent form factor into the spread model.`,
        "Home court advantage in NBA typically worth 2-3 points.",
        "Back-to-back schedule, injury reports, and rest days are key inputs not yet factored in mock data.",
      ],
    },
  ];
}
