"use client"

import { api } from "@/lib/api"
import type { User } from "@/types/api"
import { usePathname, useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"

type AuthContextValue = {
  user: User | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const publicRoutes = ["/", "/login", "/register"]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()

  const refresh = useCallback(async () => {
    try {
      const result = await api<{ user: User }>("/api/auth/me")
      setUser(result.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])
  useEffect(() => {
    if (!loading && !user && !publicRoutes.includes(pathname)) router.replace("/login")
  }, [loading, pathname, router, user])

  async function logout() {
    await api("/api/auth/logout", { method: "POST" })
    setUser(null)
    router.replace("/login")
  }

  const protectedRouteLoading = loading && !publicRoutes.includes(pathname)
  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>
    {protectedRouteLoading ? <div className="space-y-5 p-8"><Skeleton className="h-10 w-64"/><Skeleton className="h-32 w-full"/><Skeleton className="h-64 w-full"/></div> : children}
  </AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used inside AuthProvider")
  return value
}
