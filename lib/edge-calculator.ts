export function calcEdgeScore(p: {
  homeForm: string[];
  awayForm: string[];
  h2hHomeWins: number;
  h2hTotal: number;
}): { score: number; color: "red" | "yellow" | "green" } {
  const fs = (f: string[]) =>
    f.reduce((a, r) => a + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);
  const homeFormScore = (fs(p.homeForm) / 15) * 40;
  const awayFormScore = (fs(p.awayForm) / 15) * 15;
  const h2hBonus = p.h2hTotal > 0 && p.h2hHomeWins / p.h2hTotal > 0.6 ? 10 : 0;
  const score = Math.min(100, Math.max(0, Math.round(30 + homeFormScore - awayFormScore + h2hBonus)));
  const color: "red" | "yellow" | "green" = score < 40 ? "red" : score < 65 ? "yellow" : "green";
  return { score, color };
}
