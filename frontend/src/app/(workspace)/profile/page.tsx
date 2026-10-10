"use client";

import { useAuth } from "@/components/auth-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { projectPermissions, projectRole } from "@/lib/project-access";

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="mt-2 text-muted-foreground">
          Your account and project access.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{user?.name}</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <Info label="Platform role" value={user?.platformRole} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Project access</CardTitle>
          <CardDescription>
            Your permissions can be different in each project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You do not have project access yet.
            </p>
          ) : (
            user?.projects.map((project) => (
              <div key={project.projectId} className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{project.name}</p>
                  <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium">
                    {projectRole(project)?.replaceAll("_", " ") ?? "NO ROLE"}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {projectPermissions(project).join(" · ") || "No permissions assigned"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl bg-muted p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value?.replaceAll("_", " ")}</p>
    </div>
  );
}
