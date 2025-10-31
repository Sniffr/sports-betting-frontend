/**
 * Utility to convert betting odds into score probabilities for match simulation
 */

export interface ScoreProbability {
  home_score: number
  away_score: number
  probability: number
}

/**
 * Convert 1X2 odds to implied probabilities and generate score probability distribution
 * 
 * Algorithm:
 * 1. Convert odds to implied probabilities (accounts for bookmaker margin)
 * 2. Normalize probabilities
 * 3. Generate realistic score distributions based on match outcome probabilities
 */
export function oddsToScoreProbabilities(
  homeOdds: number,
  drawOdds: number | undefined,
  awayOdds: number
): ScoreProbability[] {
  const homeProb = 1 / homeOdds
  const drawProb = drawOdds ? 1 / drawOdds : 0
  const awayProb = 1 / awayOdds
  
  const total = homeProb + drawProb + awayProb
  
  const normHome = homeProb / total
  const normDraw = drawProb / total
  const normAway = awayProb / total
  
  const scoreProbabilities: ScoreProbability[] = []
  
  const homeWinScores = [
    { home: 1, away: 0, weight: 0.35 }, // Most common home win
    { home: 2, away: 0, weight: 0.20 },
    { home: 2, away: 1, weight: 0.18 },
    { home: 3, away: 0, weight: 0.10 },
    { home: 3, away: 1, weight: 0.10 },
    { home: 4, away: 0, weight: 0.04 },
    { home: 3, away: 2, weight: 0.03 }
  ]
  
  for (const score of homeWinScores) {
    scoreProbabilities.push({
      home_score: score.home,
      away_score: score.away,
      probability: normHome * score.weight
    })
  }
  
  const drawScores = [
    { home: 0, away: 0, weight: 0.30 },
    { home: 1, away: 1, weight: 0.40 },
    { home: 2, away: 2, weight: 0.20 },
    { home: 3, away: 3, weight: 0.10 }
  ]
  
  for (const score of drawScores) {
    scoreProbabilities.push({
      home_score: score.home,
      away_score: score.away,
      probability: normDraw * score.weight
    })
  }
  
  const awayWinScores = [
    { home: 0, away: 1, weight: 0.35 },
    { home: 0, away: 2, weight: 0.20 },
    { home: 1, away: 2, weight: 0.18 },
    { home: 0, away: 3, weight: 0.10 },
    { home: 1, away: 3, weight: 0.10 },
    { home: 0, away: 4, weight: 0.04 },
    { home: 2, away: 3, weight: 0.03 }
  ]
  
  for (const score of awayWinScores) {
    scoreProbabilities.push({
      home_score: score.home,
      away_score: score.away,
      probability: normAway * score.weight
    })
  }
  
  return scoreProbabilities
}

/**
 * Enhanced version that considers totals (over/under) odds
 * to adjust the score distribution for higher/lower scoring matches
 */
export function oddsToScoreProbabilitiesWithTotals(
  homeOdds: number,
  drawOdds: number | undefined,
  awayOdds: number,
  totalsPoint?: number,
  overOdds?: number,
  underOdds?: number
): ScoreProbability[] {
  let scoreProbabilities = oddsToScoreProbabilities(homeOdds, drawOdds, awayOdds)
  
  if (totalsPoint && overOdds && underOdds) {
    const overProb = 1 / overOdds
    const underProb = 1 / underOdds
    const totalProb = overProb + underProb
    
    const normOver = overProb / totalProb
    const normUnder = underProb / totalProb
    
    scoreProbabilities = scoreProbabilities.map(sp => {
      const totalGoals = sp.home_score + sp.away_score
      
      if (totalGoals > totalsPoint) {
        return {
          ...sp,
          probability: sp.probability * (0.5 + normOver * 0.5)
        }
      } else if (totalGoals < totalsPoint) {
        return {
          ...sp,
          probability: sp.probability * (0.5 + normUnder * 0.5)
        }
      }
      
      return sp
    })
    
    const totalAdjusted = scoreProbabilities.reduce((sum, sp) => sum + sp.probability, 0)
    scoreProbabilities = scoreProbabilities.map(sp => ({
      ...sp,
      probability: sp.probability / totalAdjusted
    }))
  }
  
  return scoreProbabilities
}
