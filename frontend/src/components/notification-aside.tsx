"use client"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/components/auth-provider"
import { api, getApiUrl } from "@/lib/api"
import type { Notification } from "@/types/api"
import { BellIcon, CaretLeftIcon, CaretRightIcon, CheckIcon } from "@phosphor-icons/react"
import { io } from "socket.io-client"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

function label(type: string) {
  return type.toLowerCase().replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase())
}

function notificationTitle(item: Notification) {
  if (item.type === "PROJECT_NOTE_ADDED") {
    return `New note in ${item.payload.projectName || "a project"}`
  }
  if (item.type === "PROJECT_ACCESS_APPROVED") {
    return `Access granted to ${item.payload.projectName || "project"}`
  }
  if (item.type === "PROJECT_ACCESS_REJECTED") {
    return `Access request declined for ${item.payload.projectName || "project"}`
  }
  return label(item.type)
}

export function NotificationAside() {
  const { refresh } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(true)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bulkAction, setBulkAction] = useState<"read" | "delete" | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const result = await api<{ items: Notification[] }>(`/api/notifications${unreadOnly ? "?unread=true" : ""}`)
      setItems(result.items)
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [unreadOnly])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => {
    const socket = io(getApiUrl(), { withCredentials: true })
    socket.on("notification.created", (item: Notification) => {
      setItems((current) => [item, ...current])
      if ([
        "PROJECT_MEMBERSHIP",
        "PROJECT_ROLE_CHANGED",
        "PROJECT_ACCESS_APPROVED",
        "PROJECT_ACCESS_REJECTED",
      ].includes(item.type)) {
        void refresh()
        window.dispatchEvent(new Event("project-access-changed"))
      }
    })
    return () => { socket.disconnect() }
  }, [refresh])

  async function markRead(id: string) {
    const result = await api<{ notification: Notification }>(`/api/notifications/${id}/read`, { method: "PATCH" })
    setItems((current) => current.map((item) => item._id === id ? result.notification : item))
  }

  async function markAllRead() {
    setBulkAction("read")
    try {
      await api("/api/notifications/read-all", { method: "PATCH" })
      if (unreadOnly) setItems([])
      else {
        const readAt = new Date().toISOString()
        setItems((current) => current.map((item) => item.readAt ? item : { ...item, readAt }))
      }
    } finally {
      setBulkAction(null)
    }
  }

  async function deleteRead() {
    if (!window.confirm("Delete all read notifications?")) return
    setBulkAction("delete")
    try {
      await api("/api/notifications/read", { method: "DELETE" })
      setItems((current) => current.filter((item) => !item.readAt))
    } finally {
      setBulkAction(null)
    }
  }

  const unread = items.filter((item) => !item.readAt).length
  const hasRead = items.some((item) => item.readAt)
  if (!open) return (
    <aside className="hidden w-16 shrink-0 border-l bg-card lg:flex lg:flex-col lg:items-center lg:py-5">
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open notifications" className="relative">
        <BellIcon />{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{unread}</span>}
      </Button>
      <CaretLeftIcon className="mt-4 size-4 text-muted-foreground" />
    </aside>
  )

  return (
    <aside className="hidden w-80 shrink-0 border-l bg-card lg:block">
      <div className="flex items-center justify-between border-b p-4">
        <div><p className="font-semibold">Notifications</p><p className="text-xs text-muted-foreground">{unread} unread</p></div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Collapse notifications"><CaretRightIcon /></Button>
      </div>
      <div className="flex gap-2 border-b p-3">
        <Button size="sm" variant={!unreadOnly ? "default" : "outline"} onClick={() => setUnreadOnly(false)}>All</Button>
        <Button size="sm" variant={unreadOnly ? "default" : "outline"} onClick={() => setUnreadOnly(true)}>Unread</Button>
      </div>
      <div className="grid grid-cols-2 gap-2 border-b p-3">
        <Button size="sm" variant="outline" disabled={unread === 0 || bulkAction !== null} onClick={() => void markAllRead()}>
          {bulkAction === "read" ? "Marking…" : "Mark all read"}
        </Button>
        <Button size="sm" variant="outline" disabled={!hasRead || bulkAction !== null} onClick={() => void deleteRead()}>
          {bulkAction === "delete" ? "Deleting…" : "Delete read"}
        </Button>
      </div>
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
        {loading && <div className="space-y-4 p-4">{[1,2,3].map(item=><div key={item} className="space-y-2"><Skeleton className="h-4 w-2/3"/><Skeleton className="h-3 w-1/2"/></div>)}</div>}
        {!loading && items.length === 0 && <p className="p-6 text-sm text-muted-foreground">You are all caught up.</p>}
        {items.map((item) => (
          <div key={item._id} className="border-b p-4">
            <div className="flex gap-3"><span className={`mt-1 size-2 shrink-0 rounded-full ${item.readAt ? "bg-muted" : "bg-primary"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{notificationTitle(item)}</p>
                {item.type === "PROJECT_NOTE_ADDED" && item.payload.authorName && <p className="mt-1 text-xs text-muted-foreground">Added by {item.payload.authorName}</p>}
                {item.type === "PROJECT_ACCESS_APPROVED" && item.payload.role && <p className="mt-1 text-xs text-muted-foreground">Role: {item.payload.role.replaceAll("_", " ")}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
                {item.type === "PROJECT_ACCESS_APPROVED" && item.payload.projectId && (
                  <Button
                    className="mt-3"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/projects/${item.payload.projectId}`} onClick={() => { if (!item.readAt) void markRead(item._id) }} />}
                  >
                    Open project
                  </Button>
                )}
              </div>
              {!item.readAt && <Button variant="ghost" size="icon-sm" onClick={() => markRead(item._id)} aria-label="Mark read"><CheckIcon /></Button>}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
