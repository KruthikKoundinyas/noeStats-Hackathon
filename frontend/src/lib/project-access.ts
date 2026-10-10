import type { ProjectAccess, ProjectRole } from "@/types/api"

export function projectRole(access?: ProjectAccess): ProjectRole | undefined {
  if (!access) return undefined
  return typeof access.role === "string" ? access.role : access.role?.name
}

export function projectPermissions(access: ProjectAccess): string[] {
  if (typeof access.role === "object") return access.role?.permissions ?? []
  return access.permissions ?? []
}
