"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { projectRole } from "@/lib/project-access";
import type { Project } from "@/types/api";
import { ArrowRightIcon, FolderOpenIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ProjectsPage() {
  const { user, refresh } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const canCreateProject = user?.platformRole === "ADMIN" ||
    user?.projects.some((project) => projectRole(project) === "PROJECT_MANAGER");
  const load = (showLoading = true) => {
    if (showLoading) setLoading(true);
    return api<{ items: Project[] }>("/api/projects/discover")
      .then((data) => setProjects(data.items))
      .catch((value) => setError(value.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(false);
    }, 0);
    const refreshProjects = () => { void load(false); };
    const poller = window.setInterval(refreshProjects, 5000);
    window.addEventListener("project-access-changed", refreshProjects);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poller);
      window.removeEventListener("project-access-changed", refreshProjects);
    };
  }, []);
  async function request(
    projectId: string,
    requestedRole: "TEAM_MEMBER" | "VIEWER",
  ) {
    try {
      await api(`/api/projects/${projectId}/access-requests`, {
        method: "POST",
        body: JSON.stringify({ requestedRole }),
      });
      await load();
      await refresh();
    } catch (value) {
      setError(value instanceof ApiError ? value.message : "Request failed");
    }
  }
  async function cancel(projectId: string) {
    await api(`/api/projects/${projectId}/access-requests`, {
      method: "DELETE",
    });
    load();
  }
  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setCreating(true);
    setError("");
    try {
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          description: data.get("description"),
        }),
      });
      form.reset();
      await refresh();
      await load(false);
    } catch (value) {
      setError(value instanceof ApiError ? value.message : "Unable to create project");
    } finally {
      setCreating(false);
    }
  }
  async function deleteProject(project: Project) {
    if (!window.confirm(`Delete “${project.name}” and all of its tasks, comments, and activity?`)) return;
    setDeletingId(project._id);
    setError("");
    try {
      await api(`/api/projects/${project._id}`, { method: "DELETE" });
      setProjects((current) => current.filter((item) => item._id !== project._id));
    } catch (value) {
      setError(value instanceof ApiError ? value.message : "Unable to delete project");
    } finally {
      setDeletingId(null);
    }
  }
  const mine = projects.filter(
    (project) => project.membershipRole || user?.platformRole === "ADMIN",
  );
  const discover = projects.filter(
    (project) => !project.membershipRole && user?.platformRole !== "ADMIN",
  );
  const canDelete = (project: Project) => {
    const creatorId =
      typeof project.createdBy === "string"
        ? project.createdBy
        : project.createdBy?._id;
    return user?.platformRole === "ADMIN" ||
      project.membershipRole === "PROJECT_MANAGER" ||
      creatorId === user?.id;
  };
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Projects</p>
          <h1 className="mt-1 text-3xl font-bold">Your project workspace</h1>
          <p className="mt-2 text-muted-foreground">
            Open your projects or request access to another team.
          </p>
        </div>
        {canCreateProject ? (
          <Button nativeButton={false} render={<a href="#new-project" />}>
            <PlusIcon /> New project
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            An Admin must appoint you as a Project Manager before you can create projects.
          </p>
        )}
      </div>
      {error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {canCreateProject && <Card id="new-project">
          <CardHeader>
            <CardTitle>Create project</CardTitle>
            <CardDescription>
              The creator becomes the project&apos;s initial Project Manager.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={createProject}
              className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]"
            >
              <Input
                name="name"
                placeholder="Project name"
                required
                minLength={2}
                maxLength={120}
              />
              <Input name="description" placeholder="Short description" />
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </form>
          </CardContent>
      </Card>}
      <Section title="My projects" description="Projects you can access now.">
        {loading ? (
          <ProjectSkeletons />
        ) : mine.length === 0 ? (
          <Empty />
        ) : (
          mine.map((project) => (
            <ProjectCard key={project._id} project={project}>
              <div className="flex gap-2">
                <Button nativeButton={false} render={<Link href={`/projects/${project._id}`} />}>
                  Open <ArrowRightIcon />
                </Button>
                {canDelete(project) && (
                  <Button
                    variant="destructive"
                    size="icon"
                    aria-label={`Delete ${project.name}`}
                    disabled={deletingId === project._id}
                    onClick={() => void deleteProject(project)}
                  >
                    <TrashIcon />
                  </Button>
                )}
              </div>
            </ProjectCard>
          ))
        )}
      </Section>
      {user?.platformRole !== "ADMIN" && (
        <Section
          title="Discover projects"
          description="Request access; a Project Manager will review it."
        >
          {loading ? (
            <ProjectSkeletons />
          ) : discover.length === 0 ? (
            <Empty />
          ) : (
            discover.map((project) => (
              <ProjectCard key={project._id} project={project}>
                {project.accessRequest?.status === "PENDING" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Request pending
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancel(project._id)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => request(project._id, "TEAM_MEMBER")}
                    >
                      Request member
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => request(project._id, "VIEWER")}
                    >
                      Request viewer
                    </Button>
                  </div>
                )}
              </ProjectCard>
            ))
          )}
        </Section>
      )}
    </div>
  );
}
function ProjectSkeletons() {
  return (
    <>
      {[1, 2].map((item) => (
        <Card key={item}>
          <CardHeader>
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">{children}</div>
    </section>
  );
}
function ProjectCard({
  project,
  children,
}: {
  project: Project;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3">
        <div className="rounded-xl bg-primary/15 p-3">
          <FolderOpenIcon className="size-5" />
        </div>
        <div>
          <CardTitle>{project.name}</CardTitle>
          <CardDescription className="mt-1">
            {project.description || "No description provided."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
          {project.membershipRole?.replaceAll("_", " ") || project.status}
        </span>
        {children}
      </CardContent>
    </Card>
  );
}
function Empty() {
  return (
    <div className="col-span-full rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
      Nothing to show here yet.
    </div>
  );
}
