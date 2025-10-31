import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { TrendingUp } from 'lucide-react'

interface AuthProps {
  onLogin: (userId: string, username: string) => void
}

interface StoredUser {
  userId: string
  username: string
  balance: number
  createdAt: string
}

export default function Auth({ onLogin }: AuthProps) {
  const [isSignup, setIsSignup] = useState(false)
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')

  const getStoredUsers = (): Record<string, StoredUser> => {
    try {
      return JSON.parse(localStorage.getItem('bettingUsers') || '{}')
    } catch {
      return {}
    }
  }

  const handleLogin = () => {
    setError('')
    if (!username.trim()) {
      setError('Please enter a username')
      return
    }

    const users = getStoredUsers()
    const user = Object.values(users).find(u => u.username === username.trim())

    if (!user) {
      setError('User not found. Please sign up first.')
      return
    }

    onLogin(user.userId, user.username)
  }

  const handleSignup = () => {
    setError('')
    if (!username.trim()) {
      setError('Please enter a username')
      return
    }

    const users = getStoredUsers()
    
    const existingUser = Object.values(users).find(u => u.username === username.trim())
    if (existingUser) {
      setError('Username already taken. Please choose a different one.')
      return
    }

    const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newUser: StoredUser = {
      userId: newUserId,
      username: username.trim(),
      balance: 50000,
      createdAt: new Date().toISOString()
    }

    users[newUserId] = newUser
    localStorage.setItem('bettingUsers', JSON.stringify(users))

    onLogin(newUser.userId, newUser.username)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-red-600 p-4 rounded-full">
              <TrendingUp size={48} className="text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-white mb-2">
            Super Bet
          </CardTitle>
          <CardDescription className="text-gray-400">
            {isSignup ? 'Create your betting account' : 'Login to your betting account'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  isSignup ? handleSignup() : handleLogin()
                }
              }}
              placeholder="Enter your username"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={isSignup ? handleSignup : handleLogin}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2"
            >
              {isSignup ? 'Sign Up' : 'Login'}
            </Button>

            <Button
              onClick={() => {
                setIsSignup(!isSignup)
                setError('')
              }}
              variant="ghost"
              className="w-full text-gray-400 hover:text-white hover:bg-gray-700"
            >
              {isSignup ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
            </Button>
          </div>

          {isSignup && (
            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 text-sm text-gray-300">
              <p className="font-semibold mb-2">New Account Benefits:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Starting balance: KES 50,000</li>
                <li>Track your betting history</li>
                <li>Monitor your RTP statistics</li>
                <li>Save and resume anytime</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
