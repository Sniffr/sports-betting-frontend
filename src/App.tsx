import { useState, useEffect } from 'react'
import './App.css'
import { X, TrendingUp, RefreshCw, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { oddsToScoreProbabilitiesWithTotals } from './utils/oddsConverter'
import Auth from './components/Auth'

const API_KEY = 'a3b186794403af630516172e9184ef1f'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const SIMULATION_API_URL = import.meta.env.VITE_SIMULATION_API_URL || 'http://localhost:8000'

interface Selection {
  id: string
  matchId: string
  match: string
  selection: string
  odds: number
  market: 'h2h' | 'spreads' | 'totals'
  side: 'home' | 'away' | 'draw' | 'over' | 'under'
  point?: number
}

interface PendingBet {
  id: string
  selections: Selection[]
  stake: number
  potentialWin: number
  placedAt: Date
}

interface MarketOdds {
  home: number
  draw?: number
  away: number
}

interface SpreadOdds {
  point: number
  home: number
  away: number
}

interface TotalsOdds {
  point: number
  over: number
  under: number
}

interface Match {
  id: string
  league: string
  homeTeam: string
  awayTeam: string
  time: string
  h2h?: MarketOdds
  spread?: SpreadOdds
  totals?: TotalsOdds
}

interface League {
  key: string
  title: string
}

interface CachedData {
  data: Match[]
  fetchedAt: number
  region: string
}

interface PlayerStats {
  user_id: string
  total_simulations: number
  won_slips: number
  lost_slips: number
  win_rate: number
  win_loss_rtp: number
  total_staked: number
  total_paid_out: number
  actual_rtp: number
  total_profit: number
}

interface SimulationEvent {
  minute: number
  event_type: string
  team: string
  description: string
  player: string | null
}

interface SimulationResult {
  home_team: string
  away_team: string
  final_score: { [key: string]: number }
  bet_results: Array<{
    market: string
    outcome: string
    stake?: number
    odds?: number
    won: boolean
    outcome_occurred: boolean
    payout?: number
    profit?: number
    explanation: string
  }>
  total_stake?: number
  total_payout?: number
  total_profit?: number
  bet_slip_won: boolean
  events: SimulationEvent[]
  match_stats: {
    possession: { [key: string]: number }
    shots: { [key: string]: number }
    corners: { [key: string]: number }
    fouls: { [key: string]: number }
    total_goals: number
  }
  simulation_metadata: {
    rtp: number
    volatility: string
    seed: number
    total_events: number
    number_of_bets: number
  }
}

interface BetHistory {
  id: number
  user_id: string
  home_team: string
  away_team: string
  final_score_home: number
  final_score_away: number
  bet_slip_won: boolean
  total_stake: number
  total_payout: number
  total_profit: number
  rtp: number
  timestamp: string
}

interface StoredUser {
  userId: string
  username: string
  balance: number
  createdAt: string
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null)
  const [balance, setBalance] = useState(50000)
  const [betSlip, setBetSlip] = useState<Selection[]>([])
  const [stake, setStake] = useState(100)
  const [simulations, setSimulations] = useState(1)
  const [isSimulating, setIsSimulating] = useState(false)
  const [isSimMode, setIsSimMode] = useState(true)
  const [pendingBets, setPendingBets] = useState<PendingBet[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<number>(0)
  const [requestsRemaining, setRequestsRemaining] = useState<number | null>(null)
  const [leagues, setLeagues] = useState<League[]>([])
  const [activeLeagueKey, setActiveLeagueKey] = useState<string>('soccer_epl')
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [betHistory, setBetHistory] = useState<BetHistory[]>([])
  const [showBetHistory, setShowBetHistory] = useState(false)
  const [cache, setCache] = useState<Record<string, CachedData>>(() => {
    try {
      return JSON.parse(localStorage.getItem('oddsCache') || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    const sessionUserId = localStorage.getItem('currentUserId')
    if (sessionUserId) {
      const users = JSON.parse(localStorage.getItem('bettingUsers') || '{}')
      const user = users[sessionUserId]
      if (user) {
        setCurrentUser(user)
        setBalance(user.balance)
        setIsAuthenticated(true)
      }
    }
  }, [])

  const addToBetSlip = (match: Match, market: 'h2h' | 'spreads' | 'totals', side: 'home' | 'away' | 'draw' | 'over' | 'under', odds: number, point?: number) => {
    let selectionText = ''
    
    if (market === 'h2h') {
      selectionText = side === 'home' ? match.homeTeam : side === 'draw' ? 'Draw' : match.awayTeam
    } else if (market === 'spreads') {
      const displayPoint = side === 'home' ? point! : -point!
      const sign = displayPoint >= 0 ? '+' : ''
      selectionText = `${side === 'home' ? match.homeTeam : match.awayTeam} ${sign}${displayPoint.toFixed(1)}`
    } else if (market === 'totals') {
      selectionText = `${side === 'over' ? 'Over' : 'Under'} ${point}`
    }
    
    const newSelection: Selection = {
      id: `${match.id}-${market}-${side}-${point || 0}`,
      matchId: match.id,
      match: `${match.homeTeam} vs ${match.awayTeam}`,
      selection: selectionText,
      odds: odds,
      market: market,
      side: side,
      point: point
    }

    const exists = betSlip.find(s => s.id === newSelection.id)
    if (!exists) {
      setBetSlip([...betSlip, newSelection])
    }
  }

  const removeFromBetSlip = (id: string) => {
    setBetSlip(betSlip.filter(s => s.id !== id))
  }

  const calculateTotalOdds = () => {
    if (betSlip.length === 0) return 0
    return betSlip.reduce((acc, sel) => acc * sel.odds, 1)
  }

  const calculatePotentialWin = () => {
    return stake * calculateTotalOdds()
  }

  const handleLogin = (userId: string, _username: string) => {
    const users = JSON.parse(localStorage.getItem('bettingUsers') || '{}')
    const user = users[userId]
    
    setCurrentUser(user)
    setBalance(user.balance)
    setIsAuthenticated(true)
    localStorage.setItem('currentUserId', userId)
    
    fetchPlayerStats(userId)
  }

  const handleLogout = () => {
    if (currentUser) {
      saveUserBalance()
    }
    setIsAuthenticated(false)
    setCurrentUser(null)
    localStorage.removeItem('currentUserId')
    setBetSlip([])
    setPendingBets([])
    setPlayerStats(null)
  }

  const saveUserBalance = () => {
    if (!currentUser) return
    
    const users = JSON.parse(localStorage.getItem('bettingUsers') || '{}')
    if (users[currentUser.userId]) {
      users[currentUser.userId].balance = balance
      localStorage.setItem('bettingUsers', JSON.stringify(users))
    }
  }

  const fetchPlayerStats = async (userId?: string) => {
    const id = userId || currentUser?.userId
    if (!id) return
    
    try {
      const response = await fetch(`${SIMULATION_API_URL}/api/players/${id}/stats`)
      if (response.ok) {
        const stats = await response.json()
        setPlayerStats(stats)
      } else if (response.status === 404) {
        setPlayerStats(null)
      }
    } catch (err) {
      console.error('Failed to fetch player stats:', err)
      setPlayerStats(null)
    }
  }

  const fetchBetHistory = async () => {
    if (!currentUser) return
    
    try {
      const response = await fetch(`${SIMULATION_API_URL}/api/simulations?user_id=${currentUser.userId}`)
      if (response.ok) {
        const history = await response.json()
        setBetHistory(history)
      }
    } catch (err) {
      console.error('Failed to fetch bet history:', err)
    }
  }

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      saveUserBalance()
    }
  }, [balance, isAuthenticated, currentUser])

  const runSimulation = async () => {
    if (betSlip.length === 0 || stake <= 0) return

    setIsSimulating(true)

    if (isSimMode) {
      const matchesMap = matches.reduce((acc, m) => {
        acc[m.id] = m
        return acc
      }, {} as Record<string, Match>)

      const matchGroups = betSlip.reduce((acc, sel) => {
        if (!acc[sel.matchId]) {
          acc[sel.matchId] = []
        }
        acc[sel.matchId].push(sel)
        return acc
      }, {} as Record<string, Selection[]>)

      const matchesData = []
      const betSlipData = []

      for (const [matchId, selections] of Object.entries(matchGroups)) {
        const match = matchesMap[matchId]
        if (!match || !match.h2h) continue

        const scoreProbabilities = oddsToScoreProbabilitiesWithTotals(
          match.h2h.home,
          match.h2h.draw,
          match.h2h.away,
          match.totals?.point,
          match.totals?.over,
          match.totals?.under
        )

        matchesData.push({
          match_id: matchId,
          home_team: match.homeTeam,
          away_team: match.awayTeam,
          score_probabilities: scoreProbabilities
        })

        for (const sel of selections) {
          let market: string = sel.market
          let outcome: string = sel.side

          if (market === 'h2h') {
            market = '1X2'
            if (sel.side === 'home') outcome = '1'
            else if (sel.side === 'draw') outcome = 'X'
            else if (sel.side === 'away') outcome = '2'
          } else if (market === 'totals') {
            market = 'over_under'
            outcome = `${sel.side}_${sel.point}`
          }

          betSlipData.push({
            match_id: matchId,
            home_team: match.homeTeam,
            away_team: match.awayTeam,
            market,
            outcome,
            odds: sel.odds
          })
        }
      }

      let totalWins = 0
      let totalLosses = 0
      const allResults: any[] = []

      for (let i = 0; i < simulations; i++) {
        try {
          const response = await fetch(`${SIMULATION_API_URL}/api/simulate-betslip`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: currentUser?.userId || 'guest',
              matches: matchesData,
              bet_slip: betSlipData,
              stake: stake,
              volatility: 'medium',
              seed: Date.now() + i
            })
          })

          if (response.ok) {
            const result = await response.json()
            allResults.push(result)
            
            if (result.bet_slip_won) {
              totalWins++
            } else {
              totalLosses++
            }
          }
        } catch (err) {
          console.error('Simulation request failed:', err)
        }
      }

      const totalStakeAmount = stake * simulations
      const totalWinnings = allResults
        .filter(r => r.bet_slip_won)
        .reduce((sum, r) => sum + r.actual_payout, 0)
      
      const netProfit = totalWinnings - totalStakeAmount
      setBalance(balance + netProfit)
      
      setSimulationResults(allResults)
      setShowResults(true)
      setBetSlip([])
      setIsSimulating(false)

      await fetchPlayerStats()
      await fetchBetHistory()
    } else {
      const newBet: PendingBet = {
        id: Date.now().toString(),
        selections: [...betSlip],
        stake: stake,
        potentialWin: calculatePotentialWin(),
        placedAt: new Date()
      }
      
      setBalance(balance - stake)
      setPendingBets([...pendingBets, newBet])
      setBetSlip([])
      setIsSimulating(false)
      
      alert(`Bet Placed!\n\nYour bet has been placed successfully.\nStake: KES ${stake.toFixed(2)}\nPotential Win: KES ${calculatePotentialWin().toFixed(2)}\n\nStake deducted from balance.\nWaiting for match results...\n\nNew Balance: KES ${(balance - stake).toFixed(2)}`)
    }
  }

  const settleBet = (betId: string, won: boolean) => {
    const bet = pendingBets.find(b => b.id === betId)
    if (!bet) return

    if (won) {
      setBalance(balance + bet.potentialWin)
      alert(`Bet Won!\n\nStake: KES ${bet.stake.toFixed(2)}\nWinnings: KES ${bet.potentialWin.toFixed(2)}\nProfit: KES ${(bet.potentialWin - bet.stake).toFixed(2)}\n\nNew Balance: KES ${(balance + bet.potentialWin).toFixed(2)}`)
    } else {
      alert(`Bet Lost!\n\nStake: KES ${bet.stake.toFixed(2)}\nLoss: KES ${bet.stake.toFixed(2)}\n\nBalance: KES ${balance.toFixed(2)}`)
    }

    setPendingBets(pendingBets.filter(b => b.id !== betId))
  }

  const resetBalance = () => {
    setBalance(50000)
    setBetSlip([])
    setPendingBets([])
  }

  const fetchLeagues = async () => {
    try {
      const response = await fetch(
        `https://api.the-odds-api.com/v4/sports?api_key=${API_KEY}`
      )

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      const soccerLeagues = data
        .filter((sport: any) => sport.group === 'Soccer' && sport.active && !sport.has_outrights)
        .slice(0, 10)
        .map((sport: any) => ({
          key: sport.key,
          title: sport.title
        }))

      setLeagues(soccerLeagues)
    } catch (err) {
      console.error('Failed to fetch leagues:', err)
    }
  }

  const selectBestBookmaker = (bookmakers: any[]) => {
    let bestBookmaker = null
    let bestScore = -1

    for (const bookmaker of bookmakers) {
      let score = 0
      const markets = bookmaker.markets || []
      
      const h2h = markets.find((m: any) => m.key === 'h2h')
      const spreads = markets.find((m: any) => m.key === 'spreads')
      const totals = markets.find((m: any) => m.key === 'totals')

      if (h2h && h2h.outcomes?.length >= 2) score += 1
      if (spreads && spreads.outcomes?.length >= 2 && spreads.outcomes[0]?.point !== undefined) score += 1
      if (totals && totals.outcomes?.length >= 2 && totals.outcomes[0]?.point !== undefined) score += 1

      if (score > bestScore) {
        bestScore = score
        bestBookmaker = bookmaker
      }
    }

    return bestBookmaker
  }

  const fetchOdds = async (leagueKey?: string, forceRefresh = false) => {
    const targetLeague = leagueKey || activeLeagueKey
    
    if (!forceRefresh && cache[targetLeague]) {
      const cached = cache[targetLeague]
      const age = Date.now() - cached.fetchedAt
      if (age < CACHE_TTL) {
        setMatches(cached.data)
        setLastFetch(cached.fetchedAt)
        return
      }
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `https://api.the-odds-api.com/v4/sports/${targetLeague}/odds?api_key=${API_KEY}&regions=uk&markets=h2h,spreads,totals&oddsFormat=decimal&dateFormat=iso`
      )

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      const remaining = response.headers.get('x-requests-remaining')
      if (remaining) {
        setRequestsRemaining(parseInt(remaining))
      }

      const transformedMatches: Match[] = data.slice(0, 6).map((event: any) => {
        const bookmaker = selectBestBookmaker(event.bookmakers || [])
        
        const h2hMarket = bookmaker?.markets?.find((m: any) => m.key === 'h2h')
        const spreadsMarket = bookmaker?.markets?.find((m: any) => m.key === 'spreads')
        const totalsMarket = bookmaker?.markets?.find((m: any) => m.key === 'totals')

        const commenceTime = new Date(event.commence_time)
        const timeStr = commenceTime.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })

        const match: Match = {
          id: event.id,
          league: event.sport_title,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          time: timeStr
        }

        if (h2hMarket) {
          const homeOutcome = h2hMarket.outcomes?.find((o: any) => o.name === event.home_team)
          const awayOutcome = h2hMarket.outcomes?.find((o: any) => o.name === event.away_team)
          const drawOutcome = h2hMarket.outcomes?.find((o: any) => o.name === 'Draw')

          if (homeOutcome && awayOutcome) {
            match.h2h = {
              home: homeOutcome.price || 2.0,
              draw: drawOutcome?.price,
              away: awayOutcome.price || 2.0
            }
          }
        }

        if (spreadsMarket && spreadsMarket.outcomes?.length >= 2) {
          const homeOutcome = spreadsMarket.outcomes.find((o: any) => o.name === event.home_team)
          const awayOutcome = spreadsMarket.outcomes.find((o: any) => o.name === event.away_team)

          if (homeOutcome && awayOutcome && homeOutcome.point !== undefined) {
            match.spread = {
              point: homeOutcome.point,
              home: homeOutcome.price || 2.0,
              away: awayOutcome.price || 2.0
            }
          }
        }

        if (totalsMarket && totalsMarket.outcomes?.length >= 2) {
          const overOutcome = totalsMarket.outcomes.find((o: any) => o.name === 'Over')
          const underOutcome = totalsMarket.outcomes.find((o: any) => o.name === 'Under')

          if (overOutcome && underOutcome && overOutcome.point !== undefined) {
            match.totals = {
              point: overOutcome.point,
              over: overOutcome.price || 2.0,
              under: underOutcome.price || 2.0
            }
          }
        }

        return match
      })

      setMatches(transformedMatches)
      const now = Date.now()
      setLastFetch(now)

      const newCache = {
        ...cache,
        [targetLeague]: {
          data: transformedMatches,
          fetchedAt: now,
          region: 'uk'
        }
      }
      setCache(newCache)
      localStorage.setItem('oddsCache', JSON.stringify(newCache))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch odds')
      setMatches([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLeagues()
    fetchPlayerStats()
  }, [])

  useEffect(() => {
    if (leagues.length > 0) {
      fetchOdds()
    }
  }, [activeLeagueKey, leagues])

  const handleLeagueChange = (leagueKey: string) => {
    setActiveLeagueKey(leagueKey)
    setError(null)
  }

  const getAvailableMarkets = () => {
    const markets = new Set<string>()
    matches.forEach(match => {
      if (match.h2h) markets.add('1X2')
      if (match.totals) markets.add('Over/Under')
    })
    markets.add('GG/NG (API not supported)')
    return Array.from(markets).join(', ') || 'Loading...'
  }

  const getTimeSinceLastFetch = () => {
    if (!lastFetch) return ''
    const seconds = Math.floor((Date.now() - lastFetch) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ago`
  }

  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-red-600 text-white p-4 shadow-lg">
        <div className="container mx-auto">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={32} />
              <h1 className="text-2xl font-bold">Super Bet</h1>
              <div className="flex flex-col ml-2">
                {requestsRemaining !== null && (
                  <span className="text-xs opacity-70">
                    API: {requestsRemaining} requests left
                  </span>
                )}
                {lastFetch > 0 && (
                  <span className="text-xs opacity-60">
                    Updated {getTimeSinceLastFetch()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-red-700 px-4 py-2 rounded-lg">
                <span className="text-sm opacity-80">Balance</span>
                <div className="text-xl font-bold">KES {balance.toFixed(2)}</div>
              </div>
              <Button 
                onClick={() => fetchOdds(activeLeagueKey, true)}
                disabled={isLoading}
                variant="outline"
                className="bg-white text-red-600 hover:bg-gray-100"
              >
                <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Loading...' : 'Refresh'}
              </Button>
              <Button 
                onClick={resetBalance}
                variant="outline"
                className="bg-white text-red-600 hover:bg-gray-100"
              >
                <RefreshCw size={16} className="mr-2" />
                Reset
              </Button>
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="bg-white text-red-600 hover:bg-gray-100"
              >
                <LogOut size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
          {playerStats && (
            <div className="border-t border-red-700 pt-2 mt-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex gap-4">
                  <span className="opacity-80">Player: {currentUser?.username || 'Guest'}</span>
                  <span>Simulations: {playerStats.total_simulations || 0}</span>
                  <span>Win Rate: {(playerStats.win_rate || 0).toFixed(1)}%</span>
                  <span>RTP (W/L): {(playerStats.win_loss_rtp || 0).toFixed(1)}%</span>
                  {(playerStats.total_staked || 0) > 0 && (
                    <>
                      <span>RTP (Stake): {(playerStats.actual_rtp || 0).toFixed(1)}%</span>
                      <span className={(playerStats.total_profit || 0) >= 0 ? 'text-green-300' : 'text-red-300'}>
                        Profit: KES {(playerStats.total_profit || 0).toFixed(2)}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={async () => {
                      await fetchBetHistory()
                      setShowBetHistory(true)
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-white hover:bg-red-700 h-6 px-2"
                  >
                    My Bets
                  </Button>
                  <Button 
                    onClick={() => fetchPlayerStats()}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-white hover:bg-red-700 h-6 px-2"
                  >
                    <RefreshCw size={12} className="mr-1" />
                    Refresh Stats
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Games Section */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-white text-xl font-bold">Football Leagues</h2>
                <div className="text-sm text-gray-400">
                  Markets: {getAvailableMarkets()}
                </div>
              </div>
              <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                {leagues.map(league => (
                  <button
                    key={league.key}
                    onClick={() => handleLeagueChange(league.key)}
                    className={`px-4 py-2 rounded-lg whitespace-nowrap transition font-medium ${
                      activeLeagueKey === league.key
                        ? 'bg-green-600 text-white shadow-lg'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {league.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 p-4 rounded-lg mb-4">
                {error}
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="bg-gray-800 border border-gray-700 text-gray-300 p-4 rounded-lg mb-4 text-center">
                Loading live odds...
              </div>
            )}

            {/* Matches */}
            <div className="space-y-4">
              {matches.map(match => (
                <Card key={match.id} className="bg-gray-800 border-gray-700 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-gray-400 text-xs mb-1">{match.league}</div>
                      <div className="text-gray-400 text-xs mb-2">{match.time}</div>
                    </div>
                  </div>
                  <div className="text-white font-semibold mb-4 text-base">
                    <div className="mb-1">{match.homeTeam}</div>
                    <div className="text-gray-400 text-xs mb-1">vs</div>
                    <div>{match.awayTeam}</div>
                  </div>

                  {/* 1X2 Market */}
                  {match.h2h ? (
                    <div className="mb-3">
                      <div className="text-gray-400 text-xs mb-2 font-medium">1X2</div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => addToBetSlip(match, 'h2h', 'home', match.h2h!.home)}
                          className="bg-green-600 hover:bg-green-700 text-white rounded-lg p-3 font-bold transition"
                        >
                          <div className="text-xs mb-1">1</div>
                          <div>{match.h2h.home.toFixed(2)}</div>
                        </button>
                        {match.h2h.draw ? (
                          <button
                            onClick={() => addToBetSlip(match, 'h2h', 'draw', match.h2h!.draw!)}
                            className="bg-green-600 hover:bg-green-700 text-white rounded-lg p-3 font-bold transition"
                          >
                            <div className="text-xs mb-1">X</div>
                            <div>{match.h2h.draw.toFixed(2)}</div>
                          </button>
                        ) : (
                          <div className="bg-gray-700 rounded-lg p-3 flex items-center justify-center">
                            <span className="text-gray-500 text-xs">N/A</span>
                          </div>
                        )}
                        <button
                          onClick={() => addToBetSlip(match, 'h2h', 'away', match.h2h!.away)}
                          className="bg-green-600 hover:bg-green-700 text-white rounded-lg p-3 font-bold transition"
                        >
                          <div className="text-xs mb-1">2</div>
                          <div>{match.h2h.away.toFixed(2)}</div>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3">
                      <div className="text-gray-400 text-xs mb-2 font-medium">1X2</div>
                      <div className="bg-gray-700 rounded-lg p-3 text-center">
                        <span className="text-gray-500 text-sm">Not available</span>
                      </div>
                    </div>
                  )}

                  {/* Over/Under Market */}
                  {match.totals ? (
                    <div className="mb-3">
                      <div className="text-gray-400 text-xs mb-2 font-medium">
                        Over/Under ({match.totals.point})
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => addToBetSlip(match, 'totals', 'over', match.totals!.over, match.totals!.point)}
                          className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg p-3 font-bold transition text-sm"
                        >
                          <div className="text-xs mb-1">Over {match.totals.point}</div>
                          <div>{match.totals.over.toFixed(2)}</div>
                        </button>
                        <button
                          onClick={() => addToBetSlip(match, 'totals', 'under', match.totals!.under, match.totals!.point)}
                          className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg p-3 font-bold transition text-sm"
                        >
                          <div className="text-xs mb-1">Under {match.totals.point}</div>
                          <div>{match.totals.under.toFixed(2)}</div>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3">
                      <div className="text-gray-400 text-xs mb-2 font-medium">Over/Under</div>
                      <div className="bg-gray-700 rounded-lg p-3 text-center">
                        <span className="text-gray-500 text-sm">Not available</span>
                      </div>
                    </div>
                  )}

                  {/* GG/NG Market - Not supported by API */}
                  <div className="mb-2">
                    <div className="text-gray-400 text-xs mb-2 font-medium">GG/NG (Both Teams to Score)</div>
                    <div className="bg-gray-700 rounded-lg p-3 text-center">
                      <span className="text-gray-500 text-sm">Not supported by API</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Betslip Section */}
          <div className="lg:col-span-1">
            <Card className="bg-gray-800 border-gray-700 sticky top-4">
              <div className="bg-gray-700 p-4 rounded-t-lg">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-white font-bold">Betslip</h3>
                </div>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setIsSimMode(false)}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                      !isSimMode 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                    }`}
                  >
                    Real
                  </button>
                  <button
                    onClick={() => setIsSimMode(true)}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                      isSimMode 
                        ? 'bg-yellow-500 text-black' 
                        : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                    }`}
                  >
                    Sim
                  </button>
                </div>
                <div className={`text-xs mt-2 ${isSimMode ? 'text-yellow-400' : 'text-green-400'}`}>
                  {isSimMode 
                    ? 'Place bets with virtually simulated results' 
                    : 'Place real bets with actual balance'}
                </div>
              </div>

              <div className="p-4">
                {betSlip.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    Click on odds to add selections
                  </div>
                ) : (
                  <div className="space-y-3">
                    {betSlip.map(selection => (
                      <div key={selection.id} className="bg-gray-700 p-3 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="text-white text-sm font-medium">{selection.selection}</div>
                            <div className="text-gray-400 text-xs">{selection.match}</div>
                            <div className="text-gray-500 text-xs capitalize">{selection.market}</div>
                          </div>
                          <button
                            onClick={() => removeFromBetSlip(selection.id)}
                            className="text-gray-400 hover:text-white"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <div className="text-green-400 font-bold">{selection.odds.toFixed(2)}</div>
                      </div>
                    ))}

                    <div className="border-t border-gray-600 pt-3 mt-3">
                      <div className="mb-3">
                        <label className="text-gray-400 text-sm block mb-1">Stake (KES)</label>
                        <input
                          type="number"
                          value={stake}
                          onChange={(e) => setStake(Number(e.target.value))}
                          className="w-full bg-gray-700 text-white p-2 rounded-lg"
                          min="1"
                        />
                      </div>

                      {isSimMode && (
                        <div className="mb-3">
                          <label className="text-gray-400 text-sm block mb-1">Times to Simulate</label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSimulations(Math.max(1, simulations - 1))}
                              className="bg-gray-700 text-white px-3 py-2 rounded-lg"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={simulations}
                              onChange={(e) => setSimulations(Math.max(1, Number(e.target.value)))}
                              className="flex-1 bg-gray-700 text-white p-2 rounded-lg text-center"
                              min="1"
                            />
                            <button
                              onClick={() => setSimulations(simulations + 1)}
                              className="bg-green-600 text-white px-3 py-2 rounded-lg"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="bg-gray-700 p-3 rounded-lg mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Total Odds</span>
                          <span className="text-white font-bold">{calculateTotalOdds().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">{isSimMode ? 'Total Stake' : 'Stake'}</span>
                          <span className="text-white font-bold">KES {(isSimMode ? stake * simulations : stake).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">{isSimMode ? 'Potential Win (per bet)' : 'Potential Win'}</span>
                          <span className="text-green-400 font-bold">KES {calculatePotentialWin().toFixed(2)}</span>
                        </div>
                      </div>

                      <Button
                        onClick={runSimulation}
                        disabled={isSimulating || betSlip.length === 0}
                        className={`w-full ${isSimMode ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-green-600 hover:bg-green-700 text-white'} font-bold py-3`}
                      >
                        {isSimulating 
                          ? (isSimMode ? 'Simulating...' : 'Placing Bet...') 
                          : (isSimMode 
                              ? `Run ${simulations} Simulation${simulations > 1 ? 's' : ''}` 
                              : 'Place Bet'
                            )
                        }
                      </Button>

                      <button
                        onClick={() => setBetSlip([])}
                        className="w-full mt-2 text-gray-400 hover:text-white text-sm"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Pending Bets Section */}
            {pendingBets.length > 0 && (
              <Card className="bg-gray-800 border-gray-700 mt-4">
                <div className="bg-gray-700 p-4 rounded-t-lg">
                  <h3 className="text-white font-bold">Pending Bets ({pendingBets.length})</h3>
                  <div className="text-gray-400 text-xs mt-1">
                    Waiting for match results
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {pendingBets.map(bet => (
                    <div key={bet.id} className="bg-gray-700 p-3 rounded-lg">
                      <div className="space-y-2 mb-3">
                        {bet.selections.map(sel => (
                          <div key={sel.id} className="text-sm">
                            <div className="text-white font-medium">{sel.selection}</div>
                            <div className="text-gray-400 text-xs">{sel.match} @ {sel.odds.toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-gray-600 pt-2 mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Stake</span>
                          <span className="text-white">KES {bet.stake.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Potential Win</span>
                          <span className="text-green-400 font-bold">KES {bet.potentialWin.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => settleBet(bet.id, true)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          Won
                        </Button>
                        <Button
                          onClick={() => settleBet(bet.id, false)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                          Lost
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {showResults && simulationResults.length > 0 && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">Simulation Results</h2>
                  <Button onClick={() => setShowResults(false)} className="bg-red-600 hover:bg-red-700">
                    Close
                  </Button>
                </div>
                
                <div className="p-4 space-y-4">
                  {simulationResults.map((result, idx) => (
                    <Card key={idx} className="bg-gray-900 border-gray-700">
                      <div className="p-4">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
                          <div>
                            <h3 className="text-2xl font-bold text-white mb-1">Betslip #{idx + 1}</h3>
                            <div className="text-sm text-gray-400">
                              {result.total_selections} Selection{result.total_selections > 1 ? 's' : ''}
                              {' • '}
                              Combined Odds: {result.total_odds.toFixed(2)}x
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-3xl font-bold mb-1 ${result.bet_slip_won ? 'text-green-400' : 'text-red-400'}`}>
                              {result.bet_slip_won ? '✓ WON' : '✗ LOST'}
                            </div>
                            <div className="text-sm text-gray-400">
                              {result.winning_selections}/{result.total_selections} Correct
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-800 rounded p-4 mb-4">
                          <h4 className="text-lg font-semibold text-white mb-3">Selections</h4>
                          {result.bet_results.map((bet, betIdx) => (
                            <div key={betIdx} className="mb-3 pb-3 border-b border-gray-700 last:border-0 last:pb-0 last:mb-0">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <div className="text-white font-bold text-base mb-1">
                                    {bet.home_team} vs {bet.away_team}
                                  </div>
                                  <div className="text-white font-medium">
                                    {bet.market}: {bet.outcome} @ {bet.odds.toFixed(2)}x
                                  </div>
                                  <div className="text-sm text-gray-400 mt-1">
                                    Final Score: {bet.home_score} - {bet.away_score}
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <div className={`font-bold text-lg ${bet.won ? 'text-green-400' : 'text-red-400'}`}>
                                    {bet.won ? '✓' : '✗'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="bg-gray-800 rounded p-4">
                          <h4 className="text-lg font-semibold text-white mb-3">Betslip Summary</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Stake:</span>
                              <span className="text-white font-medium">KES {result.stake.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Total Odds:</span>
                              <span className="text-white font-medium">{result.total_odds.toFixed(2)}x</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Potential Payout:</span>
                              <span className="text-blue-400 font-medium">KES {result.potential_payout.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-gray-700">
                              <span className="text-gray-400 font-semibold">Actual Payout:</span>
                              <span className={`font-bold ${result.bet_slip_won ? 'text-green-400' : 'text-red-400'}`}>
                                KES {result.actual_payout.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400 font-semibold">Profit/Loss:</span>
                              <span className={`font-bold ${result.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                KES {result.profit.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {result.matches && result.matches.length > 0 && (
                          <div className="mt-4">
                            <details className="bg-gray-800 rounded">
                              <summary className="p-4 cursor-pointer text-white font-medium hover:bg-gray-750">
                                View Match Details & Events
                              </summary>
                              <div className="p-4 space-y-4 border-t border-gray-700">
                                {result.matches.map((match, matchIdx) => (
                                  <div key={matchIdx} className="border-b border-gray-700 last:border-0 pb-4 last:pb-0">
                                    <h5 className="text-white font-bold mb-2">
                                      {match.home_team} {match.home_score} - {match.away_score} {match.away_team}
                                    </h5>
                                    
                                    <div className="bg-gray-900 rounded p-3 mb-3">
                                      <h6 className="text-sm font-semibold text-gray-400 mb-2">Statistics</h6>
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                          <span className="text-gray-400">Possession:</span>
                                          <span className="text-white ml-2">
                                            {match.match_stats.possession[match.home_team].toFixed(1)}% - 
                                            {match.match_stats.possession[match.away_team].toFixed(1)}%
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Shots:</span>
                                          <span className="text-white ml-2">
                                            {match.match_stats.shots[match.home_team]} - {match.match_stats.shots[match.away_team]}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="bg-gray-900 rounded p-3">
                                      <h6 className="text-sm font-semibold text-gray-400 mb-2">Events</h6>
                                      <div className="max-h-40 overflow-y-auto space-y-1">
                                        {match.events.slice(0, 10).map((event, eventIdx) => (
                                          <div key={eventIdx} className="text-sm flex">
                                            <span className="text-gray-500 w-12">{event.minute}'</span>
                                            <span className={`flex-1 ${
                                              event.event_type === 'goal' ? 'text-green-400 font-bold' :
                                              event.event_type === 'kickoff' || event.event_type === 'halftime' || event.event_type === 'fulltime' ? 'text-blue-400' :
                                              'text-gray-300'
                                            }`}>
                                              {event.description}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showBetHistory && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">My Bets</h2>
                  <Button onClick={() => setShowBetHistory(false)} className="bg-red-600 hover:bg-red-700">
                    Close
                  </Button>
                </div>
                
                <div className="p-4">
                  {betHistory.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      No betting history found. Place some bets to see them here!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {betHistory.map((bet) => (
                        <Card key={bet.id} className="bg-gray-900 border-gray-700">
                          <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="text-lg font-bold text-white">
                                  {bet.home_team} vs {bet.away_team}
                                </h3>
                                <div className="text-sm text-gray-400">
                                  {new Date(bet.timestamp).toLocaleString()}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-white">
                                  {bet.final_score_home} - {bet.final_score_away}
                                </div>
                                <div className={`text-sm font-bold ${bet.bet_slip_won ? 'text-green-400' : 'text-red-400'}`}>
                                  {bet.bet_slip_won ? '✓ WON' : '✗ LOST'}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-700">
                              <div>
                                <div className="text-xs text-gray-400">Stake</div>
                                <div className="text-white font-medium">KES {bet.total_stake.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-400">Payout</div>
                                <div className="text-green-400 font-medium">KES {bet.total_payout.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-400">Profit</div>
                                <div className={`font-medium ${bet.total_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  KES {bet.total_profit.toFixed(2)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-400">RTP</div>
                                <div className="text-white font-medium">{(bet.rtp * 100).toFixed(1)}%</div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
