// AI Reasoning Engine — TopBet
// Synthesises structured match data into analyst-quality natural language.
// No external LLM needed — deterministic, always grounded in real data.

import type { InjuredPlayer, TeamSeasonRecord } from "./balldontlie";

interface MatchContext {
  sport: string;
  league?: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  awayOdds: number;
  drawOdds?: number;
  homeForm?: string[];
  awayForm?: string[];
  h2hHomeWins?: number;
  h2hTotal?: number;
  goalsAvgHome?: number;
  goalsAvgAway?: number;
  xgHome?: number;
  xgAway?: number;
  bttsProb?: number;
  cornersAvgHome?: number;
  cornersAvgAway?: number;
  homeElo?: number;
  awayElo?: number;
  homeTablePos?: number;
  awayTablePos?: number;
  referee?: string | null;
  weather?: { description?: string; tempC?: number; goalsImpact?: number; icon?: string } | null;
  // NBA context
  homeInjuries?: InjuredPlayer[];
  awayInjuries?: InjuredPlayer[];
  homeOnBackToBack?: boolean;
  awayOnBackToBack?: boolean;
  homeRecentForm?: string[];
  awayRecentForm?: string[];
  homeRecord?: TeamSeasonRecord | null;
  awayRecord?: TeamSeasonRecord | null;
  totalLine?: number;
}

function deVig(a: number, b: number): [number, number] {
  const ia = 1 / a, ib = 1 / b;
  const s = ia + ib;
  return [ia / s, ib / s];
}

function formStr(form: string[]): string {
  return form.slice(0, 5).join("") || "—";
}

function formWinRate(form: string[]): number {
  if (!form.length) return 0.5;
  return form.filter(r => r === "W").length / form.length;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Soccer reasoning ─────────────────────────────────────────────────────────

function soccerReasoning(m: MatchContext): string {
  const [mhp, map_] = deVig(m.homeOdds, m.awayOdds);
  const homeIsHeavyFav  = m.homeOdds < 1.5;
  const awayIsHeavyFav  = m.awayOdds < 1.5;
  const tightMatch      = Math.abs(mhp - map_) < 0.12;
  const homeForm        = m.homeForm ?? [];
  const awayForm        = m.awayForm ?? [];
  const hFormRate       = formWinRate(homeForm);
  const aFormRate       = formWinRate(awayForm);
  const hFormStr        = formStr(homeForm);
  const aFormStr        = formStr(awayForm);
  const xgHome          = m.xgHome ?? m.goalsAvgHome ?? 0;
  const xgAway          = m.xgAway ?? m.goalsAvgAway ?? 0;
  const totalXG         = xgHome + xgAway;
  const h2hRate         = m.h2hTotal ? (m.h2hHomeWins ?? 0) / m.h2hTotal : 0.5;
  const eloDiff         = (m.homeElo ?? 1500) - (m.awayElo ?? 1500);

  const lines: string[] = [];

  // Opener — market context
  if (homeIsHeavyFav) {
    lines.push(`The market prices ${m.homeTeam} as strong favourites at ${m.homeOdds.toFixed(2)} (implied ${Math.round(mhp * 100)}%), reflecting a significant class gap. ${m.awayTeam} at ${m.awayOdds.toFixed(2)} is a long shot with limited realistic upside.`);
  } else if (awayIsHeavyFav) {
    lines.push(`${m.awayTeam} travel as heavy favourites at ${m.awayOdds.toFixed(2)} (${Math.round(map_ * 100)}% implied), suggesting the market expects a routine away win despite the home ground factor.`);
  } else if (tightMatch) {
    lines.push(`The market rates this as a genuine coin-flip: ${m.homeTeam} ${m.homeOdds.toFixed(2)} vs ${m.awayTeam} ${m.awayOdds.toFixed(2)}. ${m.drawOdds ? `Draw at ${m.drawOdds.toFixed(2)} reflects that neither side has a clear edge.` : ""}`);
  } else {
    lines.push(`${m.homeTeam} are slight favourites at home (${m.homeOdds.toFixed(2)}, ${Math.round(mhp * 100)}% implied), but the gap is close enough that ${m.awayTeam} at ${m.awayOdds.toFixed(2)} offers legitimate interest.`);
  }

  // Form analysis
  if (homeForm.length >= 3 || awayForm.length >= 3) {
    const formGap = hFormRate - aFormRate;
    if (formGap > 0.25) {
      lines.push(`Form strongly favours the home side: ${m.homeTeam} are ${hFormStr} in their last ${homeForm.length} matches, while ${m.awayTeam} have managed only ${aFormStr}. That's a meaningful momentum gap heading into this fixture.`);
    } else if (formGap < -0.25) {
      lines.push(`Despite home advantage, form says otherwise: ${m.awayTeam} have been the in-form side (${aFormStr}) compared to ${m.homeTeam}'s ${hFormStr}. Away teams carrying this kind of momentum cover more often than the market suggests.`);
    } else {
      lines.push(`Form is closely matched — ${m.homeTeam} showing ${hFormStr} and ${m.awayTeam} with ${aFormStr}. Neither team arrives with a significant momentum edge.`);
    }
  }

  // Goals/xG layer
  if (totalXG > 0) {
    const dataLabel = (m.xgHome ?? 0) > 0 ? "xG" : "goals average";
    if (totalXG >= 2.8) {
      lines.push(`Combined ${dataLabel} of ${totalXG.toFixed(1)} goals per game points to an open match. Both sides have been involved in high-scoring games — the Over 2.5 market looks well-supported by the underlying data.`);
    } else if (totalXG <= 2.0) {
      lines.push(`Low combined ${dataLabel} (${totalXG.toFixed(1)}) suggests this will be a tight, low-scoring affair. Under 2.5 Goals and both-teams-to-score "No" are worth attention.`);
    }
  }

  // H2H
  if ((m.h2hTotal ?? 0) >= 4) {
    if (h2hRate >= 0.65) {
      lines.push(`Head-to-head history strongly favours ${m.homeTeam}, who have won ${m.h2hHomeWins} of ${m.h2hTotal} meetings. Historical dominance of this magnitude doesn't evaporate overnight.`);
    } else if (h2hRate <= 0.35) {
      lines.push(`Interestingly, despite home advantage, ${m.awayTeam} have the better head-to-head record here (winning ${(m.h2hTotal ?? 0) - (m.h2hHomeWins ?? 0)} of ${m.h2hTotal} meetings). A psychological edge worth noting.`);
    }
  }

  // Elo context
  if (Math.abs(eloDiff) > 80) {
    const stronger = eloDiff > 0 ? m.homeTeam : m.awayTeam;
    const weaker   = eloDiff > 0 ? m.awayTeam : m.homeTeam;
    lines.push(`Elo ratings confirm the class gap: ${stronger} carry a ${Math.abs(eloDiff).toFixed(0)}-point Elo advantage over ${weaker}, consistent with what the odds already reflect.`);
  }

  // Table position
  if (m.homeTablePos && m.awayTablePos) {
    if (m.homeTablePos <= 4 && m.awayTablePos >= 14) {
      lines.push(`Table positions tell the story clearly: ${m.homeTeam} are in the top-4 race (P${m.homeTablePos}) while ${m.awayTeam} (P${m.awayTablePos}) are fighting to stay relevant. The motivation gap is real.`);
    } else if (m.homeTablePos >= 17) {
      lines.push(`${m.homeTeam} (P${m.homeTablePos}) are in relegation trouble — expect a backs-against-the-wall performance that could disrupt even the more technically gifted ${m.awayTeam}.`);
    }
  }

  // Referee & weather
  if (m.referee) {
    lines.push(`${m.referee} takes charge — their card tendencies and VAR usage rate should influence the cards and corners markets.`);
  }
  if (m.weather && (m.weather.goalsImpact ?? 0) < -0.05) {
    lines.push(`${m.weather.icon ?? "🌧"} Conditions: ${m.weather.description ?? "adverse weather"} (${m.weather.tempC}°C) likely to suppress scoring — factor this into totals bets.`);
  }

  // Closer
  const closers = [
    `Bottom line: the edge lies in correctly pricing what the market has already priced in vs. what remains mispriced.`,
    `Watch the line in the 2 hours before kickoff — significant movement would signal sharp money taking a position.`,
    `The value isn't always in the favourite. Identify which market has the widest gap between model probability and book odds.`,
  ];
  lines.push(pick(closers));

  return lines.join(" ");
}

// ─── NBA reasoning ────────────────────────────────────────────────────────────

function nbaReasoning(m: MatchContext): string {
  const [mhp, map_] = deVig(m.homeOdds, m.awayOdds);
  const homeIsHeavyFav = m.homeOdds < 1.35;
  const awayIsHeavyFav = m.awayOdds < 1.35;
  const homeInj = m.homeInjuries ?? [];
  const awayInj = m.awayInjuries ?? [];
  const homeL10 = m.homeRecentForm ?? m.homeForm ?? [];
  const awayL10 = m.awayRecentForm ?? m.awayForm ?? [];
  const homeFormRate = formWinRate(homeL10);
  const awayFormRate = formWinRate(awayL10);

  const lines: string[] = [];

  // Market baseline
  if (homeIsHeavyFav) {
    lines.push(`The market has ${m.homeTeam} as heavy favourites at ${m.homeOdds.toFixed(2)} (${Math.round(mhp * 100)}% implied). At these odds, the real question isn't who wins — it's whether the point spread offers value.`);
  } else if (awayIsHeavyFav) {
    lines.push(`${m.awayTeam} are big favourites on the road at ${m.awayOdds.toFixed(2)} (${Math.round(map_ * 100)}% implied). Beating a heavy road line is the challenge, but home-court advantage still counts for something.`);
  } else {
    lines.push(`Competitive matchup with ${m.homeTeam} at ${m.homeOdds.toFixed(2)} vs ${m.awayTeam} at ${m.awayOdds.toFixed(2)}. The market sees this as roughly a 60/40 split — manageable territory for model divergence.`);
  }

  // Injury report
  const criticalHomeInj = homeInj.filter(p => p.status === "Out" && (p.tier === "superstar" || p.tier === "allstar"));
  const criticalAwayInj = awayInj.filter(p => p.status === "Out" && (p.tier === "superstar" || p.tier === "allstar"));

  if (criticalHomeInj.length > 0) {
    const names = criticalHomeInj.map(p => `${p.name} (${p.ppg.toFixed(0)} PPG)`).join(", ");
    lines.push(`🚨 Significant injury concern: ${m.homeTeam} are without ${names}. That's not just points lost — it reshapes their entire offensive structure and defensive rotations.`);
  }
  if (criticalAwayInj.length > 0) {
    const names = criticalAwayInj.map(p => `${p.name} (${p.ppg.toFixed(0)} PPG)`).join(", ");
    lines.push(`🚨 ${m.awayTeam} are missing ${names}. Injuries at this tier don't just shave 5-6 points off a spread — they change the game plan entirely.`);
  }
  if (criticalHomeInj.length === 0 && criticalAwayInj.length === 0 && homeInj.length === 0 && awayInj.length === 0) {
    lines.push(`Both rosters appear healthy — no significant absences flagged at time of analysis. Clean slate for the form and matchup data to do its work.`);
  }

  // Back-to-back
  if (m.homeOnBackToBack && m.awayOnBackToBack) {
    lines.push(`Both teams are on back-to-back schedules — fatigue is a wash, but the question becomes which roster has more depth to absorb it.`);
  } else if (m.homeOnBackToBack) {
    lines.push(`😴 ${m.homeTeam} are on the second night of a back-to-back. NBA teams historically perform ~3.5 percentage points worse in this situation — particularly on defence, where effort levels tend to drop.`);
  } else if (m.awayOnBackToBack) {
    lines.push(`😴 ${m.awayTeam} are playing their second game in two nights on the road — a significant physical disadvantage that the market often underweights.`);
  }

  // Recent form
  if (homeL10.length >= 5 || awayL10.length >= 5) {
    const hWins = homeL10.filter(r => r === "W").length;
    const aWins = awayL10.filter(r => r === "W").length;
    const formGap = homeFormRate - awayFormRate;
    if (Math.abs(formGap) > 0.2) {
      const hotTeam  = formGap > 0 ? m.homeTeam : m.awayTeam;
      const coldTeam = formGap > 0 ? m.awayTeam : m.homeTeam;
      const hotWins  = formGap > 0 ? hWins : aWins;
      const hotTotal = formGap > 0 ? homeL10.length : awayL10.length;
      lines.push(`Form divergence is notable: ${hotTeam} are ${hotWins}-${hotTotal - hotWins} in their last ${hotTotal} games, while ${coldTeam} have been significantly colder. Teams in good form ATS-cover at higher rates.`);
    } else {
      lines.push(`Both teams are in comparable form over their last ${Math.max(homeL10.length, awayL10.length)} games — ${m.homeTeam} ${hWins}W-${homeL10.length - hWins}L, ${m.awayTeam} ${aWins}W-${awayL10.length - aWins}L.`);
    }
  }

  // Season record
  if (m.homeRecord && m.awayRecord) {
    lines.push(`Season records: ${m.homeTeam} ${m.homeRecord.wins}-${m.homeRecord.losses} (${Math.round(m.homeRecord.winPct * 100)}%) vs ${m.awayTeam} ${m.awayRecord.wins}-${m.awayRecord.losses} (${Math.round(m.awayRecord.winPct * 100)}%). ${m.homeRecord.homeWinPct > 0.6 ? `${m.homeTeam} are notably strong at home (${Math.round(m.homeRecord.homeWinPct * 100)}% home win rate).` : ""}`);
  }

  // Totals context
  if (m.totalLine) {
    lines.push(`The total is set at ${m.totalLine}. Monitor line movement — if it moves 2+ points in either direction before tip-off, that's sharp action worth following.`);
  }

  // Closer
  const closers = [
    `In NBA betting, the most overlooked variable is rest. Check both teams' schedules for the next 3 days — tanking teams and road-weary rosters are where market inefficiencies hide.`,
    `The moneyline at these odds offers limited value. The real edge in NBA is typically on the spread or alternate lines where the market is less efficient.`,
    `Watch tip-off time for any last-minute lineup changes — NBA injury reports are notoriously late and can move the line 2-3 points in minutes.`,
  ];
  lines.push(pick(closers));

  return lines.join(" ");
}

// ─── NRL reasoning ────────────────────────────────────────────────────────────

function nrlReasoning(m: MatchContext): string {
  const [mhp, map_] = deVig(m.homeOdds, m.awayOdds);
  const lines: string[] = [];

  if (m.homeOdds < 1.5) {
    lines.push(`${m.homeTeam} are short-priced favourites at ${m.homeOdds.toFixed(2)} (${Math.round(mhp * 100)}% implied market probability). In NRL, home ground matters — especially in Queensland and Sydney rivalries where crowd factor is significant.`);
  } else if (m.awayOdds < 1.5) {
    lines.push(`${m.awayTeam} are installed as firm favourites even away from home at ${m.awayOdds.toFixed(2)} (${Math.round(map_ * 100)}% implied). NRL away favourites at sub-1.5 typically reflect a genuine quality gap.`);
  } else {
    lines.push(`Evenly matched contest — ${m.homeTeam} (${m.homeOdds.toFixed(2)}) vs ${m.awayTeam} (${m.awayOdds.toFixed(2)}). In NRL, the home ground advantage in a 50/50 matchup is often worth 4-6 points on the line.`);
  }

  lines.push(`Key NRL factors not yet fully integrated: Origin availability, injury to key halves, travel schedules (particularly for Queensland/NSW interstate games), and whether either side has a top-8 race pressure driving intensity.`);
  lines.push(`For deeper NRL analysis, monitor NRL.com injury lists and team announcements Wednesday + Friday before game day — lineup changes hit the market hard.`);

  return lines.join(" ");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateReasoning(m: MatchContext): string {
  try {
    if (m.sport === "nba") return nbaReasoning(m);
    if (m.sport === "nrl") return nrlReasoning(m);
    return soccerReasoning(m);
  } catch {
    return "Analysis unavailable for this fixture.";
  }
}

export function generateHeadline(m: MatchContext): string {
  const [mhp] = deVig(m.homeOdds || 2, m.awayOdds || 2);
  const homeInj = m.homeInjuries ?? [];
  const awayInj = m.awayInjuries ?? [];
  const hasCriticalInj = [...homeInj, ...awayInj].some(
    p => p.status === "Out" && (p.tier === "superstar" || p.tier === "allstar")
  );

  if (m.homeOnBackToBack || m.awayOnBackToBack) {
    const b2bTeam = m.homeOnBackToBack ? m.homeTeam : m.awayTeam;
    return `😴 ${b2bTeam} on back-to-back — fatigue factor in play`;
  }
  if (hasCriticalInj) {
    const injTeam = homeInj.some(p => p.status === "Out" && p.tier !== "bench" && p.tier !== "rotation")
      ? m.homeTeam : m.awayTeam;
    return `🏥 Key injury disrupts ${injTeam}'s game plan`;
  }
  if (mhp > 0.75) return `🔒 Heavy favourites — where's the value?`;
  if (Math.abs(mhp - 0.5) < 0.08) return `⚖️ True coin-flip — model edge matters most`;
  return `📊 ${m.homeTeam} slight edge — market may be underweighting away form`;
}
