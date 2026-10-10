"use client"

import { NotificationAside } from "@/components/notification-aside"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { BellIcon, ChartBarIcon, FolderIcon, ListIcon, SignOutIcon, UserCircleIcon, UsersIcon } from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

const baseLinks = [
  { href: "/dashboard", label: "Dashboard", icon: ChartBarIcon },
  { href: "/projects", label: "Projects", icon: FolderIcon },
  { href: "/profile", label: "Profile", icon: UserCircleIcon },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  if (loading || !user) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading NeoStats…</div>
  const links = user.platformRole === "ADMIN" ? [...baseLinks.slice(0, 2), { href: "/users", label: "Users", icon: UsersIcon }, baseLinks[2]] : baseLinks
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-6 px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">N</span><span>NeoStats</span></Link>
          <nav className="hidden items-center gap-1 md:flex">{links.map(({ href, label, icon: Icon }) => <Button key={href} nativeButton={false} variant={pathname.startsWith(href) ? "secondary" : "ghost"} render={<Link href={href} />}><Icon />{label}</Button>)}</nav>
          <div className="ml-auto flex items-center gap-2"><Button className="lg:hidden" variant="ghost" size="icon" onClick={() => setMobileOpen((value) => !value)}><ListIcon /></Button><span className="hidden text-sm sm:block">{user.name}</span><Button variant="ghost" size="icon" onClick={logout} aria-label="Log out"><SignOutIcon /></Button></div>
        </div>
        {mobileOpen && <nav className="grid gap-1 border-t p-3 md:hidden">{links.map(({ href, label, icon: Icon }) => <Button key={href} nativeButton={false} variant="ghost" className="justify-start" render={<Link href={href} onClick={() => setMobileOpen(false)} />}><Icon />{label}</Button>)}<Button variant="ghost" className="justify-start lg:hidden"><BellIcon />Notifications</Button></nav>}
      </header>
      <div className="mx-auto flex w-full max-w-[1600px] flex-1"><main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main><NotificationAside /></div>
    </div>
  )
}
