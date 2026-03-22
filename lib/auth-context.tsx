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

  useEffect(() => {
    let isMounted = true

    const loadSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const sessionUser = data.session?.user

        if (sessionUser && isMounted) {
          const profile = await fetchProfile(sessionUser.id)

          if (profile && isMounted) {
            setUser(profile)

            try {
              await updateActivityStatus(profile.id, currentPageRef.current, true)
            } catch (e) {
              console.error('Failed to update activity during session load', e)
            }
          }
        }
      } catch (e) {
        console.error('Failed to load session', e)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadSession()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const sessionUser = session?.user

        if (sessionUser) {
          const profile = await fetchProfile(sessionUser.id)

          if (profile && isMounted) {
            setUser(profile)

            try {
              await updateActivityStatus(profile.id, currentPageRef.current, true)
            } catch (e) {
              console.error('Failed to update activity during auth change', e)
            }
          }
        } else if (isMounted) {
          setUser(null)
        }
      } catch (e) {
        console.error('Auth state change failed', e)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const beat = async () => {
      try {
        await updateActivityStatus(user.id, currentPageRef.current, true)
      } catch (e) {
        if (!cancelled) console.error('Failed to update activity', e)
      }
    }

    beat()
    const interval = setInterval(beat, 30000)
    const beforeUnload = () => {
      void setOffline(user.id)
    }
    window.addEventListener('beforeunload', beforeUnload)

    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [user])

  const login = useCallback(async (username: string, password: string) => {
    const normalizedUsername = username
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")

    if (!normalizedUsername || !password) {
      return { success: false, error: 'Username and password are required' }
    }

    const emailLike = normalizedUsername.includes('@')
      ? normalizedUsername
      : `${normalizedUsername}@example.com`

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailLike,
      password,
    })
    if (error || !data.user) return { success: false, error: error?.message || 'Login failed' }

    const profile = await fetchProfile(data.user.id)
    if (!profile) return { success: false, error: 'Profile not found' }
    setUser(profile)
    await updateActivityStatus(profile.id, currentPageRef.current, true)
    return { success: true }
  }, [])

  const register = useCallback(async (username: string, password: string, role: UserRole) => {
    const cleanUsername = username
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")

    if (!cleanUsername) return { success: false, error: 'Username is required' }
    if (!password.trim()) return { success: false, error: 'Password is required' }
    if (password.length < 3) return { success: false, error: 'Password must be at least 3 characters' }

    const email = `${cleanUsername}@example.com`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: cleanUsername, role } },
    })
    if (error || !data.user) return { success: false, error: error?.message || 'Registration failed' }

    if (role === 'player') {
      await supabase.from('characters').upsert({ user_id: data.user.id, name: emptyCharacter.info.name, class_name: '', subclass: '', race: '', background: '', alignment: '', level: 1, xp: 0, proficiency_bonus: 2, armor_class: 10, initiative: 0, speed: 30, hp_max: 0, hp_current: 0, hp_temp: 0, hit_dice_total: 0, hit_dice_type: '', death_successes: 0, death_failures: 0, str_score: 10, dex_score: 10, con_score: 10, int_score: 10, wis_score: 10, cha_score: 10, features: '', languages: '' })
      const { data: charRow } = await supabase.from('characters').select('id').eq('user_id', data.user.id).single()
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
    if (!profile) return { success: false, error: 'Profile not created' }
    setUser(profile)
    await updateActivityStatus(profile.id, currentPageRef.current, true)
    return { success: true }
  }, [])

  const logout = useCallback(async () => {
    if (user) {
      try {
        await setOffline(user.id)
      } catch {}
    }

    await supabase.auth.signOut()
    setUser(null)
    window.location.reload()
  }, [user])

  const getAllUsers = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('id, username, role, created_at').order('created_at', { ascending: true })
    if (error) {
      console.error(error)
      return []
    }
    return (data ?? []).map((row) => ({ id: row.id, username: row.username, role: row.role, createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined }))
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
    currentPageRef.current = page
    if (user) {
      try {
        await updateActivityStatus(user.id, page, true)
      } catch (e) {
        console.error('Failed to update current page', e)
      }
    }
  }, [user])

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      register,
      logout,
      getAllUsers,
      getAllPlayerCharacters,
      updateCurrentPage,
    }}>
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
