'use client'

import { useAuth } from '@/lib/auth-context'
import { WelcomePage } from '@/components/auth/welcome-page'
import { PlayerDashboard } from '@/components/dashboards/player-dashboard'
import { DMDashboard } from '@/components/dashboards/dm-dashboard'

export default function DnDApp() {
  const { user, isLoading } = useAuth()

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 size-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Not logged in - show welcome page
  if (!user) {
    return <WelcomePage />
  }

  // Role-based routing
  if (user.role === 'dm') {
    return <DMDashboard />
  }

  // Default: Player dashboard
  return <PlayerDashboard />
}
