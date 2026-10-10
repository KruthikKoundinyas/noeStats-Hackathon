export type PlatformRole = "ADMIN" | "USER"
export type ProjectRole = "PROJECT_MANAGER" | "TEAM_MEMBER" | "VIEWER"

export type ProjectAccess = {
  projectId: string
  name: string
  status: "ACTIVE" | "ARCHIVED"
  joinedAt: string
  role: ProjectRole | { name: ProjectRole; permissions: string[] }
  permissions?: string[]
}

export type User = {
  id: string
  _id?: string
  name: string
  email: string
  platformRole: PlatformRole
  isActive: boolean
  projects: ProjectAccess[]
}

export type Project = {
  _id: string
  name: string
  description: string
  markdownContent?: string
  notes?: ProjectNote[]
  status: "ACTIVE" | "ARCHIVED"
  updatedAt: string
  createdBy?: string | { _id: string; name?: string; email?: string }
  membershipRole?: ProjectRole | null
  accessRequest?: { _id: string; requestedRole: ProjectRole; status: string } | null
}

export type ProjectNote = {
  _id: string
  content: string
  createdBy: string | { _id: string; name: string; email?: string }
  createdAt: string
  updatedAt: string
}

export type Task = {
  _id: string
  projectId: string
  title: string
  description: string
  status: "TODO" | "IN_PROGRESS" | "DONE"
  assigneeId?: { _id: string; name: string; email: string } | string | null
  version: number
  updatedAt: string
}

export type Notification = {
  _id: string
  type: string
  payload: Record<string, string>
  readAt: string | null
  createdAt: string
}
