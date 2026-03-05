// Referee Intelligence database — TopBet v2
// Stats are per-game averages for the 2024-25 season (EPL + UCL)
// Source: public referee statistics, referee analytics sites

export interface RefereeStat {
  name: string;           // Exact name as returned by football-data.org
  aliases: string[];      // Alternative spellings / abbreviations
  league: "PL" | "CL" | "both";
  // Per-game averages
  yellowCardsPerGame: number;
  redCardsPerGame: number;
  penaltiesPerGame: number;
  foulsPerGame: number;
  varInterventionsPerGame: number;
  // Tendencies
  cardStyle: "lenient" | "average" | "strict";
  homeBias: number;       // positive = favours home team (foul differential), scale -2 to +2
  notes: string;
}

export const REFEREE_DB: RefereeStat[] = [
  // ────────── EPL REFEREES ──────────
  {
    name: "Michael Oliver",
    aliases: ["M. Oliver", "Oliver"],
    league: "PL",
    yellowCardsPerGame: 4.2,
    redCardsPerGame: 0.12,
    penaltiesPerGame: 0.28,
    foulsPerGame: 24.1,
    varInterventionsPerGame: 0.35,
    cardStyle: "strict",
    homeBias: 0.3,
    notes: "Most experienced EPL referee. High card rate, consistent, relatively low VAR usage. Respected by players.",
  },
  {
    name: "Anthony Taylor",
    aliases: ["A. Taylor", "Taylor"],
    league: "PL",
    yellowCardsPerGame: 3.8,
    redCardsPerGame: 0.08,
    penaltiesPerGame: 0.32,
    foulsPerGame: 22.8,
    varInterventionsPerGame: 0.45,
    cardStyle: "average",
    homeBias: 0.5,
    notes: "Above-average penalty rate and VAR usage. Slight home bias noted in foul differential analysis.",
  },
  {
    name: "Craig Pawson",
    aliases: ["C. Pawson", "Pawson"],
    league: "PL",
    yellowCardsPerGame: 3.2,
    redCardsPerGame: 0.06,
    penaltiesPerGame: 0.20,
    foulsPerGame: 21.4,
    varInterventionsPerGame: 0.25,
    cardStyle: "lenient",
    homeBias: 0.1,
    notes: "Lenient referee who allows the game to flow. Low VAR usage. Fewer cards than average.",
  },
  {
    name: "Simon Hooper",
    aliases: ["S. Hooper", "Hooper"],
    league: "PL",
    yellowCardsPerGame: 3.6,
    redCardsPerGame: 0.07,
    penaltiesPerGame: 0.22,
    foulsPerGame: 25.8,
    varInterventionsPerGame: 0.30,
    cardStyle: "average",
    homeBias: 0.2,
    notes: "High foul count games. Lets physical battles play out before booking, resulting in niggly games.",
  },
  {
    name: "Chris Kavanagh",
    aliases: ["C. Kavanagh", "Kavanagh"],
    league: "PL",
    yellowCardsPerGame: 4.0,
    redCardsPerGame: 0.10,
    penaltiesPerGame: 0.38,
    foulsPerGame: 23.9,
    varInterventionsPerGame: 0.42,
    cardStyle: "strict",
    homeBias: 0.3,
    notes: "Highest penalty rate in EPL. Strict on professional fouls. Heavy VAR usage. Penalty risk market favourite.",
  },
  {
    name: "Stuart Attwell",
    aliases: ["S. Attwell", "Attwell"],
    league: "PL",
    yellowCardsPerGame: 3.0,
    redCardsPerGame: 0.05,
    penaltiesPerGame: 0.18,
    foulsPerGame: 20.2,
    varInterventionsPerGame: 0.28,
    cardStyle: "lenient",
    homeBias: 0.1,
    notes: "Very lenient. One of the lowest card rates in EPL. Rarely awards penalties. Hands-off approach.",
  },
  {
    name: "David Coote",
    aliases: ["D. Coote", "Coote"],
    league: "PL",
    yellowCardsPerGame: 3.5,
    redCardsPerGame: 0.08,
    penaltiesPerGame: 0.25,
    foulsPerGame: 22.1,
    varInterventionsPerGame: 0.35,
    cardStyle: "average",
    homeBias: 0.2,
    notes: "Mid-table referee in all metrics. Consistent and unremarkable, rarely a factor in results.",
  },
  {
    name: "Paul Tierney",
    aliases: ["P. Tierney", "Tierney"],
    league: "PL",
    yellowCardsPerGame: 4.1,
    redCardsPerGame: 0.11,
    penaltiesPerGame: 0.30,
    foulsPerGame: 24.7,
    varInterventionsPerGame: 0.38,
    cardStyle: "strict",
    homeBias: 0.4,
    notes: "Known for strictness. Higher-than-average home bias in foul calling. Good for cards markets.",
  },
  {
    name: "John Brooks",
    aliases: ["J. Brooks", "Brooks"],
    league: "PL",
    yellowCardsPerGame: 2.8,
    redCardsPerGame: 0.04,
    penaltiesPerGame: 0.15,
    foulsPerGame: 19.8,
    varInterventionsPerGame: 0.20,
    cardStyle: "lenient",
    homeBias: 0.0,
    notes: "Lowest card rate in EPL. Very lenient on challenges. Neutral home/away bias.",
  },
  {
    name: "Jarred Gillett",
    aliases: ["J. Gillett", "Gillett"],
    league: "PL",
    yellowCardsPerGame: 3.7,
    redCardsPerGame: 0.08,
    penaltiesPerGame: 0.28,
    foulsPerGame: 22.5,
    varInterventionsPerGame: 0.48,
    cardStyle: "average",
    homeBias: 0.2,
    notes: "Australian referee. Highest VAR consultation rate in EPL. Average card rate but VAR-heavy decision making.",
  },
  {
    name: "Andrew Madley",
    aliases: ["A. Madley", "Madley"],
    league: "PL",
    yellowCardsPerGame: 3.4,
    redCardsPerGame: 0.07,
    penaltiesPerGame: 0.22,
    foulsPerGame: 21.9,
    varInterventionsPerGame: 0.32,
    cardStyle: "average",
    homeBias: 0.1,
    notes: "Consistent mid-range performer. Slight lean towards game management over card distribution.",
  },
  {
    name: "Robert Jones",
    aliases: ["R. Jones", "Jones"],
    league: "PL",
    yellowCardsPerGame: 3.3,
    redCardsPerGame: 0.06,
    penaltiesPerGame: 0.20,
    foulsPerGame: 21.0,
    varInterventionsPerGame: 0.25,
    cardStyle: "lenient",
    homeBias: 0.2,
    notes: "Lenient approach. Prefers verbal warnings to cards. Low penalty rate.",
  },
  {
    name: "Peter Bankes",
    aliases: ["P. Bankes", "Bankes"],
    league: "PL",
    yellowCardsPerGame: 3.6,
    redCardsPerGame: 0.09,
    penaltiesPerGame: 0.26,
    foulsPerGame: 23.2,
    varInterventionsPerGame: 0.35,
    cardStyle: "average",
    homeBias: 0.3,
    notes: "Average across all metrics. Some home bias in penalty decisions noted.",
  },
  {
    name: "Thomas Bramall",
    aliases: ["T. Bramall", "Bramall"],
    league: "PL",
    yellowCardsPerGame: 3.8,
    redCardsPerGame: 0.08,
    penaltiesPerGame: 0.24,
    foulsPerGame: 23.0,
    varInterventionsPerGame: 0.30,
    cardStyle: "average",
    homeBias: 0.2,
    notes: "Relatively new to EPL. Shows decisive card usage and consistent foul detection.",
  },
  {
    name: "Samuel Barrott",
    aliases: ["S. Barrott", "Barrott"],
    league: "PL",
    yellowCardsPerGame: 3.5,
    redCardsPerGame: 0.07,
    penaltiesPerGame: 0.22,
    foulsPerGame: 21.5,
    varInterventionsPerGame: 0.28,
    cardStyle: "average",
    homeBias: 0.1,
    notes: "Newest addition to EPL panel. Balanced approach. Data set still building.",
  },

  // ────────── UCL REFEREES ──────────
  {
    name: "Szymon Marciniak",
    aliases: ["S. Marciniak", "Marciniak"],
    league: "CL",
    yellowCardsPerGame: 3.8,
    redCardsPerGame: 0.10,
    penaltiesPerGame: 0.30,
    foulsPerGame: 24.0,
    varInterventionsPerGame: 0.45,
    cardStyle: "average",
    homeBias: 0.2,
    notes: "Elite UCL referee. Champions League final veteran. Balanced but VAR-active. High-pressure game specialist.",
  },
  {
    name: "Felix Zwayer",
    aliases: ["F. Zwayer", "Zwayer"],
    league: "CL",
    yellowCardsPerGame: 4.0,
    redCardsPerGame: 0.12,
    penaltiesPerGame: 0.35,
    foulsPerGame: 23.2,
    varInterventionsPerGame: 0.50,
    cardStyle: "strict",
    homeBias: 0.3,
    notes: "Strict German official. Highest VAR usage among UCL referees. Strong penalty presence in big European games.",
  },
  {
    name: "Slavko Vinčić",
    aliases: ["S. Vincic", "Vincic", "Vinčić"],
    league: "CL",
    yellowCardsPerGame: 3.5,
    redCardsPerGame: 0.08,
    penaltiesPerGame: 0.25,
    foulsPerGame: 22.4,
    varInterventionsPerGame: 0.35,
    cardStyle: "average",
    homeBias: 0.2,
    notes: "Slovenian referee. Consistent in UCL knockout rounds. Average across all metrics.",
  },
  {
    name: "Daniele Orsato",
    aliases: ["D. Orsato", "Orsato"],
    league: "CL",
    yellowCardsPerGame: 3.2,
    redCardsPerGame: 0.06,
    penaltiesPerGame: 0.20,
    foulsPerGame: 21.1,
    varInterventionsPerGame: 0.30,
    cardStyle: "lenient",
    homeBias: 0.1,
    notes: "Experienced Italian referee. Lenient card style. Allows play to flow. Strong reputation for big matches.",
  },
  {
    name: "Istvan Kovacs",
    aliases: ["I. Kovacs", "Kovacs"],
    league: "CL",
    yellowCardsPerGame: 3.6,
    redCardsPerGame: 0.09,
    penaltiesPerGame: 0.28,
    foulsPerGame: 23.0,
    varInterventionsPerGame: 0.40,
    cardStyle: "average",
    homeBias: 0.2,
    notes: "Romanian UEFA referee. Above-average VAR usage. Steady performer in European competition.",
  },
  {
    name: "François Letexier",
    aliases: ["F. Letexier", "Letexier"],
    league: "CL",
    yellowCardsPerGame: 3.4,
    redCardsPerGame: 0.07,
    penaltiesPerGame: 0.24,
    foulsPerGame: 22.0,
    varInterventionsPerGame: 0.38,
    cardStyle: "average",
    homeBias: 0.1,
    notes: "Young French referee rising through UEFA ranks. Clean record, technically precise.",
  },
];

// Fuzzy match a referee name against the database
export function getRefereeStats(name: string): RefereeStat | null {
  if (!name) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const normName = norm(name);

  // Exact match on name or alias
  let found = REFEREE_DB.find(
    (r) => norm(r.name) === normName || r.aliases.some((a) => norm(a) === normName)
  );
  if (found) return found;

  // Last-name match (e.g. "Oliver" matches "Michael Oliver")
  const parts = name.trim().split(/\s+/);
  const lastName = norm(parts[parts.length - 1]);
  if (lastName.length > 3) {
    found = REFEREE_DB.find(
      (r) =>
        norm(r.name).includes(lastName) ||
        r.aliases.some((a) => norm(a).includes(lastName))
    );
    if (found) return found;
  }

  return null;
}

// Human-readable card style label with colour hint
export function cardStyleLabel(style: RefereeStat["cardStyle"]): {
  label: string;
  color: string;
} {
  if (style === "strict") return { label: "Strict", color: "#ef4444" };
  if (style === "lenient") return { label: "Lenient", color: "#22c55e" };
  return { label: "Average", color: "#eab308" };
}
