'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import { emptyCharacter, emptyInventory, emptySpellbook, User, UserRole } from './auth-types'
import { supabase } from './supabase'
import { listPlayerCharacters, setOffline, updateActivityStatus } from './supabase-data'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (username: string, password: string, role: UserRole) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  getAllUsers: () => Promise<User[]>
  getAllPlayerCharacters: () => Promise<Array<{ username: string; character: any; activity?: any }>>
  updateCurrentPage: (page: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function normalizeUsername(username: string) {
  return username.trim().toLowerCase().replace(/\s+/g, '')
}

function usernameToEmail(username: string) {
  const normalized = normalizeUsername(username)
  return normalized.includes('@') ? normalized : `${normalized}@example.com`
}

async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, role, created_at')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Failed to fetch profile', error)
    return null
  }

  if (!data) {
    console.error('Profile not found for user', userId)
    return null
  }

  return {
    id: data.id,
    username: data.username,
    role: data.role,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const currentPageRef = useRef('app')
  const lastHydratedUserIdRef = useRef<string | null>(null)
  const presenceStartedForRef = useRef<string | null>(null)
  const lastPresenceWriteRef = useRef(0)
  const lastPresencePageRef = useRef('')

  const hydrateUserFromSession = useCallback(async (userId: string) => {
    const profile = await fetchProfile(userId)

    if (!profile) {
      setUser(null)
      lastHydratedUserIdRef.current = null
      return null
    }

    setUser(profile)
    lastHydratedUserIdRef.current = profile.id
    return profile
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Failed to get session', error)
          return
        }

        const sessionUser = data.session?.user
        if (!sessionUser || !isMounted) {
          setUser(null)
          return
        }

        await hydrateUserFromSession(sessionUser.id)
      } catch (e) {
        console.error('Failed to load session', e)
        if (isMounted) setUser(null)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUser = session?.user ?? null

      window.setTimeout(() => {
        if (!isMounted) return

        if (!sessionUser) {
          lastHydratedUserIdRef.current = null
          presenceStartedForRef.current = null
          setUser(null)
          setIsLoading(false)
          return
        }

        if (
          (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
          lastHydratedUserIdRef.current === sessionUser.id
        ) {
          setIsLoading(false)
          return
        }

        void (async () => {
          try {
            await hydrateUserFromSession(sessionUser.id)
          } catch (e) {
            console.error('Auth state change failed', e)
          } finally {
            if (isMounted) setIsLoading(false)
          }
        })()
      }, 0)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [hydrateUserFromSession])

  useEffect(() => {
    if (!user?.id) return
    if (presenceStartedForRef.current === user.id) return

    presenceStartedForRef.current = user.id
    let cancelled = false

    const heartbeat = async (force = false) => {
      const now = Date.now()
      if (!force && now - lastPresenceWriteRef.current < 45000) return
      if (!force && lastPresencePageRef.current === currentPageRef.current) return
      try {
        await updateActivityStatus(user.id, currentPageRef.current, true)
        lastPresenceWriteRef.current = now
        lastPresencePageRef.current = currentPageRef.current
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to update activity', e)
        }
      }
    }

    void heartbeat(true)
    const interval = window.setInterval(() => {
      void heartbeat()
    }, 60000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void heartbeat(true)
      }
    }

    const handleBeforeUnload = () => {
      void setOffline(user.id)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      presenceStartedForRef.current = null
    }
  }, [user?.id])

  const login = useCallback(async (username: string, password: string) => {
    const normalizedUsername = normalizeUsername(username)

    if (!normalizedUsername || !password) {
      return { success: false, error: 'Username and password are required' }
    }

    const emailLike = usernameToEmail(normalizedUsername)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailLike,
      password,
    })

    if (error || !data.user) {
      return { success: false, error: error?.message || 'Login failed' }
    }

    const profile = await fetchProfile(data.user.id)
    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    setUser(profile)
    lastHydratedUserIdRef.current = profile.id

    return { success: true }
  }, [])

  const register = useCallback(async (username: string, password: string, role: UserRole) => {
    const cleanUsername = normalizeUsername(username)

    if (!cleanUsername) return { success: false, error: 'Username is required' }
    if (!password.trim()) return { success: false, error: 'Password is required' }
    if (password.length < 3) return { success: false, error: 'Password must be at least 3 characters' }

    const email = usernameToEmail(cleanUsername)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: cleanUsername, role } },
    })

    if (error || !data.user) {
      return { success: false, error: error?.message || 'Registration failed' }
    }

    if (role === 'player') {
      await supabase.from('characters').upsert({
        user_id: data.user.id,
        name: emptyCharacter.info.name,
        class_name: '',
        subclass: '',
        race: '',
        background: '',
        alignment: '',
        level: 1,
        xp: 0,
        proficiency_bonus: 2,
        armor_class: 10,
        initiative: 0,
        speed: 30,
        hp_max: 0,
        hp_current: 0,
        hp_temp: 0,
        hit_dice_total: 0,
        hit_dice_type: '',
        death_successes: 0,
        death_failures: 0,
        str_score: 10,
        dex_score: 10,
        con_score: 10,
        int_score: 10,
        wis_score: 10,
        cha_score: 10,
        features: '',
        languages: '',
      })

      const { data: charRow } = await supabase
        .from('characters')
        .select('id')
        .eq('user_id', data.user.id)
        .single()

      if (charRow?.id) {
        await supabase.from('character_notes').upsert({
          character_id: charRow.id,
          notes: JSON.stringify({
            notes: [],
            inventoryCurrency: emptyInventory.currency,
            spellbookMeta: {
              spellcastingClass: emptySpellbook.spellcastingClass,
              spellcastingAbility: emptySpellbook.spellcastingAbility,
              spellSaveDC: emptySpellbook.spellSaveDC,
              spellAttackBonus: emptySpellbook.spellAttackBonus,
              slots: emptySpellbook.slots,
            },
          }),
        })
      }
    }

    const profile = await fetchProfile(data.user.id)
    if (!profile) {
      return { success: false, error: 'Profile not created' }
    }

    setUser(profile)
    lastHydratedUserIdRef.current = profile.id

    return { success: true }
  }, [])

  const logout = useCallback(async () => {
    if (user) {
      void setOffline(user.id).catch((e) => {
        console.error('Failed to set offline during logout', e)
      })
    }

    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) {
      console.error('Logout signOut failed', error)
    }
    lastHydratedUserIdRef.current = null
    presenceStartedForRef.current = null
    setUser(null)
  }, [user])

  const getAllUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, created_at')
      .order('created_at', { ascending: true })

    if (error) {
      console.error(error)
      return []
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      username: row.username,
      role: row.role,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
    }))
  }, [])

  const getAllPlayerCharacters = useCallback(async () => {
    try {
      return await listPlayerCharacters()
    } catch (e) {
      console.error('Failed to load player characters', e)
      return []
    }
  }, [])

  const updateCurrentPage = useCallback(async (page: string) => {
    if (currentPageRef.current === page) return
    currentPageRef.current = page

    if (user) {
      try {
        await updateActivityStatus(user.id, page, true)
        lastPresenceWriteRef.current = Date.now()
        lastPresencePageRef.current = page
      } catch (e) {
        console.error('Failed to update current page', e)
      }
    }
  }, [user])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        getAllUsers,
        getAllPlayerCharacters,
        updateCurrentPage,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
