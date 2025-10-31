import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface AuthProps {
  onLogin: (username: string) => void
  onRegister: (username: string) => void
}

export function Auth({ onLogin, onRegister }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim()) {
      setError('Please enter a username')
      return
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }

    if (isLogin) {
      const existingUser = localStorage.getItem(`balance_${username}`)
      if (!existingUser) {
        setError('User not found. Please register first.')
        return
      }
      onLogin(username)
    } else {
      const existingUser = localStorage.getItem(`balance_${username}`)
      if (existingUser) {
        setError('Username already exists. Please login instead.')
        return
      }
      onRegister(username)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700 p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Sports Betting
          </h1>
          <p className="text-gray-400">
            {isLogin ? 'Login to your account' : 'Create a new account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              autoComplete="username"
            />
          </div>

          {error && (
            <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2"
          >
            {isLogin ? 'Login' : 'Register'}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
                setUsername('')
              }}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            New users start with KES 50,000 balance
          </p>
        </div>
      </Card>
    </div>
  )
}
