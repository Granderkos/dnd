'use client'

import { useState, memo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { UserRole } from '@/lib/auth-types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Shield, Sword, Crown, Users } from 'lucide-react'

export const WelcomePage = memo(function WelcomePage() {
  const { login, register } = useAuth()
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  
  // Login state
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  
  // Register state
  const [registerUsername, setRegisterUsername] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerRole, setRegisterRole] = useState<UserRole>('player')
  const [registerError, setRegisterError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    
    const result = await login(loginUsername, loginPassword)
    if (!result.success) {
      setLoginError(result.error || 'Login failed')
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegisterError('')
    
    const result = await register(registerUsername, registerPassword, registerRole)
    if (!result.success) {
      setRegisterError(result.error || 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Hero Section */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Shield className="size-16 text-primary" />
            <Sword className="size-8 text-primary absolute -right-2 -bottom-1 rotate-45" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          D&D Character Manager
        </h1>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Manage your characters, spells, and adventures
        </p>
      </div>

      {/* Auth Card */}
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'register')}>
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1">Login</TabsTrigger>
              <TabsTrigger value="register" className="flex-1">Register</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        
        <CardContent>
          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-username">Username</Label>
                <Input
                  id="login-username"
                  type="text"
                  placeholder="Enter username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              
              {loginError && (
                <p className="text-sm text-destructive">{loginError}</p>
              )}
              
              <Button type="submit" className="w-full">
                Login
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-username">Username</Label>
                <Input
                  id="register-username"
                  type="text"
                  placeholder="Choose username"
                  value={registerUsername}
                  onChange={(e) => setRegisterUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <Input
                  id="register-password"
                  type="password"
                  placeholder="Choose password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="register-role">Role</Label>
                <Select value={registerRole} onValueChange={(v) => setRegisterRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">
                      <div className="flex items-center gap-2">
                        <Users className="size-4" />
                        <span>Player</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="dm">
                      <div className="flex items-center gap-2">
                        <Crown className="size-4" />
                        <span>Dungeon Master</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {registerRole === 'player' 
                    ? 'Players manage their own character sheet' 
                    : 'DMs can view all players and manage maps'}
                </p>
              </div>
              
              {registerError && (
                <p className="text-sm text-destructive">{registerError}</p>
              )}
              
              <Button type="submit" className="w-full">
                Create Account
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Version */}
      <p className="mt-6 text-xs text-muted-foreground">v2.3</p>
    </div>
  )
})
