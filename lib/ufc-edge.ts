// UFC/MMA edge model — NOT Poisson. Uses market implied prob vs fighter win rate.
import { FighterStats } from './espn-mma'

export interface UFCEdgeResult {
  fighter: string          // name of fighter with edge
  fighterKey: 'home' | 'away'
  marketOdds: number       // Cloudbet decimal odds
  marketImplied: number    // 1 / odds (0-1)
  modelProb: number        // our model's probability (0-1)
  edge: number             // modelProb - marketImplied (positive = value)
  confidence: 'low' | 'medium' | 'high'
}

export function calcUFCEdge(
  homeStats: FighterStats | null,
  awayStats: FighterStats | null,
  homeOdds: number,
  awayOdds: number,
): UFCEdgeResult | null {
  if (homeOdds <= 1 || awayOdds <= 1) return null

  // Market implied probabilities (remove vig with normalization)
  const rawHome = 1 / homeOdds
  const rawAway = 1 / awayOdds
  const vig = rawHome + rawAway
  const marketHome = rawHome / vig
  const marketAway = rawAway / vig

  // Model probabilities — build from stats or fall back to market
  let modelHome = marketHome
  let modelAway = marketAway

  if (homeStats && awayStats) {
    // Base: win rates
    const totalH = homeStats.wins + homeStats.losses || 1
    const totalA = awayStats.wins + awayStats.losses || 1
    const wrHome = homeStats.wins / totalH
    const wrAway = awayStats.wins / totalA

    // Normalize win rates against each other
    const wrSum = wrHome + wrAway || 1
    const relHome = wrHome / wrSum
    const relAway = wrAway / wrSum

    // Blend with market (40% our model, 60% market — conservative for UFC)
    // UFC is hard to model, so we stay close to market and look for mispricing
    modelHome = 0.6 * marketHome + 0.4 * relHome
    modelAway = 0.6 * marketAway + 0.4 * relAway

    // Normalize
    const sum = modelHome + modelAway
    modelHome /= sum
    modelAway /= sum
  }

  // Calculate edges
  const edgeHome = modelHome - marketHome
  const edgeAway = modelAway - marketAway

  // Return whichever fighter has positive edge ≥ threshold
  const MIN_EDGE = 0.06 // 6% minimum for UFC (higher uncertainty)

  if (edgeHome >= edgeAway && edgeHome >= MIN_EDGE) {
    return {
      fighter: homeStats?.name ?? 'Home Fighter',
      fighterKey: 'home',
      marketOdds: homeOdds,
      marketImplied: marketHome,
      modelProb: modelHome,
      edge: edgeHome,
      confidence: edgeHome >= 0.12 ? 'high' : edgeHome >= 0.08 ? 'medium' : 'low',
    }
  } else if (edgeAway >= MIN_EDGE) {
    return {
      fighter: awayStats?.name ?? 'Away Fighter',
      fighterKey: 'away',
      marketOdds: awayOdds,
      marketImplied: marketAway,
      modelProb: modelAway,
      edge: edgeAway,
      confidence: edgeAway >= 0.12 ? 'high' : edgeAway >= 0.08 ? 'medium' : 'low',
    }
  }

  return null // no edge
}
