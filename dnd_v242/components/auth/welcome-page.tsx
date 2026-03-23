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
import { AppControls } from '@/components/app/app-controls'
import { APP_VERSION } from '@/lib/app-config'
import { useI18n } from '@/lib/i18n'

export const WelcomePage = memo(function WelcomePage() {
  const { login, register } = useAuth()
  const { t } = useI18n()
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
      setLoginError(result.error || t('auth.loginFailed'))
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegisterError('')
    
    const result = await register(registerUsername, registerPassword, registerRole)
    if (!result.success) {
      setRegisterError(result.error || t('auth.registrationFailed'))
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4">
      {/* Hero Section */}
      <div className="absolute right-4 top-4"><AppControls compact /></div>

      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Shield className="size-16 text-primary" />
            <Sword className="size-8 text-primary absolute -right-2 -bottom-1 rotate-45" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('auth.title')}
        </h1>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          {t('auth.subtitle')}
        </p>
      </div>

      {/* Auth Card */}
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'register')}>
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1">{t('auth.login')}</TabsTrigger>
              <TabsTrigger value="register" className="flex-1">{t('auth.register')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        
        <CardContent>
          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-username">{t('auth.username')}</Label>
                <Input
                  id="login-username"
                  type="text"
                  placeholder={t('auth.enterUsername')}
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="login-password">{t('auth.password')}</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder={t('auth.enterPassword')}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              
              {loginError && (
                <p className="text-sm text-destructive">{loginError}</p>
              )}
              
              <Button type="submit" className="w-full">
                {t('auth.login')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-username">{t('auth.username')}</Label>
                <Input
                  id="register-username"
                  type="text"
                  placeholder={t('auth.chooseUsername')}
                  value={registerUsername}
                  onChange={(e) => setRegisterUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="register-password">{t('auth.password')}</Label>
                <Input
                  id="register-password"
                  type="password"
                  placeholder={t('auth.choosePassword')}
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="register-role">{t('auth.role')}</Label>
                <Select value={registerRole} onValueChange={(v) => setRegisterRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">
                      <div className="flex items-center gap-2">
                        <Users className="size-4" />
                        <span>{t('auth.player')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="dm">
                      <div className="flex items-center gap-2">
                        <Crown className="size-4" />
                        <span>{t('auth.dm')}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {registerRole === 'player' 
                    ? t('auth.playerHint') 
                    : t('auth.dmHint')}
                </p>
              </div>
              
              {registerError && (
                <p className="text-sm text-destructive">{registerError}</p>
              )}
              
              <Button type="submit" className="w-full">
                {t('auth.createAccount')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Version */}
      <p className="mt-6 text-xs text-muted-foreground">{APP_VERSION}</p>
    </div>
  )
})
