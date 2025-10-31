/**
 * Utility functions to generate missing markets based on existing odds
 * and convert odds to probabilities for simulation
 */

import { ScoreProbability } from './oddsConverter'

export interface SupportedMarket {
  market_type: string
  name: string
  description: string
  possible_outcomes: string[]
  example: string
}

export interface MatchMarkets {
  h2h?: {
    home: number
    draw?: number
    away: number
  }
  totals?: {
    point: number
    over: number
    under: number
  }
  bothTeamsToScore?: {
    yes: number
    no: number
  }
  correctScore?: {
    scores: Array<{ score: string, odds: number }>
  }
}

/**
 * Generate missing markets based on existing odds and probabilities
 */
export function generateMissingMarkets(
  match: { h2h?: { home: number, draw?: number, away: number }, totals?: { point: number, over: number, under: number } },
  _supportedMarkets?: SupportedMarket[]
): MatchMarkets {
  const markets: MatchMarkets = {
    ...(match.h2h ? { h2h: match.h2h } : {}),
    ...(match.totals ? { totals: match.totals } : {})
  }

  // Generate Both Teams To Score odds based on existing probabilities
  if (!markets.bothTeamsToScore) {
    const homeProb = match.h2h ? 1 / match.h2h.home : 0.33
    const awayProb = match.h2h ? 1 / match.h2h.away : 0.33
    
    // Estimate BTTS probability based on match outcome probabilities
    // If both teams are likely to score, higher BTTS probability
    // Simple heuristic: more balanced teams = higher BTTS chance
    const teamBalance = Math.min(homeProb, awayProb) / Math.max(homeProb, awayProb)
    const avgWinProb = (homeProb + awayProb) / 2
    const bttsProb = 0.4 + (teamBalance * 0.3) + (avgWinProb * 0.2)
    
    // Add bookmaker margin (~5%)
    const margin = 1.05
    markets.bothTeamsToScore = {
      yes: (1 / bttsProb) * margin,
      no: (1 / (1 - bttsProb)) * margin
    }
  }

  // Generate Over/Under markets if missing (for multiple thresholds)
  if (match.totals) {
    // Already have totals, but we could add more thresholds
    // For now, we'll use the existing one
  } else if (match.h2h) {
    // Generate a basic over/under 2.5 based on 1X2 odds
    const homeProb = 1 / match.h2h.home
    const awayProb = 1 / match.h2h.away
    const drawProb = match.h2h.draw ? 1 / match.h2h.draw : 0.34
    
    // Estimate over 2.5 probability
    // More attacking teams (higher win probabilities) = more goals
    const attackRating = (homeProb + awayProb) / 2
    const over25Prob = 0.3 + (attackRating * 0.4) - (drawProb * 0.2)
    
    const margin = 1.05
    markets.totals = {
      point: 2.5,
      over: (1 / over25Prob) * margin,
      under: (1 / (1 - over25Prob)) * margin
    }
  }

  // Generate correct score odds (common scores only)
  if (!markets.correctScore && match.h2h) {
    const homeProb = 1 / match.h2h.home
    const awayProb = 1 / match.h2h.away
    const drawProb = match.h2h.draw ? 1 / match.h2h.draw : 0.34
    
    // Common scores with estimated probabilities
    const commonScores = [
      { score: '0-0', prob: drawProb * 0.2 },
      { score: '1-0', prob: homeProb * 0.15 },
      { score: '0-1', prob: awayProb * 0.15 },
      { score: '1-1', prob: drawProb * 0.3 },
      { score: '2-0', prob: homeProb * 0.12 },
      { score: '0-2', prob: awayProb * 0.12 },
      { score: '2-1', prob: homeProb * 0.18 },
      { score: '1-2', prob: awayProb * 0.18 },
      { score: '2-2', prob: drawProb * 0.2 },
      { score: '3-0', prob: homeProb * 0.08 },
      { score: '0-3', prob: awayProb * 0.08 },
      { score: '3-1', prob: homeProb * 0.1 },
      { score: '1-3', prob: awayProb * 0.1 },
      { score: '3-2', prob: (homeProb + awayProb) * 0.05 },
      { score: '4-0', prob: homeProb * 0.03 },
      { score: '0-4', prob: awayProb * 0.03 }
    ]
    
    // Normalize probabilities
    const totalProb = commonScores.reduce((sum, s) => sum + s.prob, 0)
    const margin = 1.1
    
    markets.correctScore = {
      scores: commonScores.map(s => ({
        score: s.score,
        odds: (1 / (s.prob / totalProb)) * margin
      }))
    }
  }

  return markets
}

/**
 * Convert odds to probabilities for all markets
 * Used when sending to simulation API
 */
export function oddsToProbabilities(
  markets: MatchMarkets,
  _supportedMarkets?: SupportedMarket[]
): ScoreProbability[] {
  // Start with base 1X2 probabilities
  let scoreProbabilities: ScoreProbability[] = []
  
  if (markets.h2h) {
    const homeProb = 1 / markets.h2h.home
    const drawProb = markets.h2h.draw ? 1 / markets.h2h.draw : 0
    const awayProb = 1 / markets.h2h.away
    
    const total = homeProb + drawProb + awayProb
    const normHome = homeProb / total
    const normDraw = drawProb / total
    const normAway = awayProb / total
    
    // Generate score distributions
    const homeWinScores = [
      { home: 1, away: 0, weight: 0.35 },
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
    
    // Adjust based on Over/Under if available
    if (markets.totals) {
      const overProb = 1 / markets.totals.over
      const underProb = 1 / markets.totals.under
      const totalProb = overProb + underProb
      const normOver = overProb / totalProb
      
      scoreProbabilities = scoreProbabilities.map(sp => {
        const totalGoals = sp.home_score + sp.away_score
        if (totalGoals > markets.totals!.point) {
          return {
            ...sp,
            probability: sp.probability * (0.5 + normOver * 0.5)
          }
        } else if (totalGoals < markets.totals!.point) {
          return {
            ...sp,
            probability: sp.probability * (0.5 + (1 - normOver) * 0.5)
          }
        }
        return sp
      })
      
      // Normalize
      const totalAdjusted = scoreProbabilities.reduce((sum, sp) => sum + sp.probability, 0)
      scoreProbabilities = scoreProbabilities.map(sp => ({
        ...sp,
        probability: sp.probability / totalAdjusted
      }))
    }
    
    // Adjust based on Both Teams To Score if available
    if (markets.bothTeamsToScore) {
      const bttsYesProb = 1 / markets.bothTeamsToScore.yes
      const bttsNoProb = 1 / markets.bothTeamsToScore.no
      const totalBTTS = bttsYesProb + bttsNoProb
      const normBTTSYes = bttsYesProb / totalBTTS
      
      scoreProbabilities = scoreProbabilities.map(sp => {
        const bothScored = sp.home_score > 0 && sp.away_score > 0
        if (bothScored) {
          return {
            ...sp,
            probability: sp.probability * (0.5 + normBTTSYes * 0.5)
          }
        } else {
          return {
            ...sp,
            probability: sp.probability * (0.5 + (1 - normBTTSYes) * 0.5)
          }
        }
      })
      
      // Normalize again
      const totalAdjusted = scoreProbabilities.reduce((sum, sp) => sum + sp.probability, 0)
      scoreProbabilities = scoreProbabilities.map(sp => ({
        ...sp,
        probability: sp.probability / totalAdjusted
      }))
    }
  }
  
  return scoreProbabilities
}

/**
 * Get market display name
 */
export function getMarketDisplayName(marketType: string): string {
  const names: Record<string, string> = {
    '1X2': '1X2',
    'over_under': 'Over/Under',
    'both_teams_to_score': 'Both Teams To Score',
    'correct_score': 'Correct Score'
  }
  return names[marketType] || marketType
}

/**
 * Convert frontend market to API market format
 */
export function convertMarketToAPI(market: string, side: string, point?: number): { market: string, outcome: string } {
  if (market === 'h2h') {
    return {
      market: '1X2',
      outcome: side === 'home' ? '1' : side === 'draw' ? 'X' : '2'
    }
  } else if (market === 'totals') {
    return {
      market: 'over_under',
      outcome: `${side}_${point}`
    }
  } else if (market === 'btts') {
    return {
      market: 'both_teams_to_score',
      outcome: side === 'yes' ? 'yes' : 'no'
    }
  } else if (market === 'correct_score') {
    return {
      market: 'correct_score',
      outcome: side // side contains the score like "2-1"
    }
  }
  return { market, outcome: side }
}

