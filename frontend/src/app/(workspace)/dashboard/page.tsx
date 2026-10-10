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
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Project, Task } from "@/types/api";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  FolderIcon,
  ListChecksIcon,
  SpinnerGapIcon,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) return;
    api<{ items: Project[] }>("/api/projects")
      .then(async ({ items }) => {
        setProjects(items);
        const results = await Promise.all(
          items
            .slice(0, 6)
            .map((item) =>
              api<{ items: Task[] }>(`/api/projects/${item._id}/tasks`).catch(
                () => ({ items: [] }),
              ),
            ),
        );
        setTasks(results.flatMap((result) => result.items));
      })
      .finally(() => setLoading(false));
  }, [user]);
  const assigned = tasks.filter(
    (task) =>
      typeof task.assigneeId === "object" && task.assigneeId?._id === user?.id,
  );
  const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS");
  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Workspace overview</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Welcome back, {user?.name}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Here is what needs your attention today.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/projects" />}>
          View projects <ArrowRightIcon />
        </Button>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            { label: "My projects", value: projects.length, icon: FolderIcon },
            {
              label: "Assigned tasks",
              value: assigned.length,
              icon: ListChecksIcon,
            },
            {
              label: "In progress",
              value: inProgress.length,
              icon: SpinnerGapIcon,
            },
            {
              label: "Completed",
              value: tasks.filter((task) => task.status === "DONE").length,
              icon: CheckCircleIcon,
            },
          ] satisfies { label: string; value: number; icon: Icon }[]
        ).map(({ label, value, icon: MetricIcon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-3xl font-bold">{value}</p>
              </div>
              <div className="rounded-xl bg-primary/15 p-3">
                <MetricIcon className="size-5 text-primary-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>My projects</CardTitle>
            <CardDescription>
              Projects you can currently access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <LoadingRows />
            ) : projects.length === 0 ? (
              <Empty text="No project access yet. Discover a project and request access." />
            ) : (
              projects.slice(0, 5).map((project) => (
                <Link
                  href={`/projects/${project._id}`}
                  key={project._id}
                  className="flex items-center justify-between rounded-xl border p-4 transition hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {project.description || "No description"}
                    </p>
                  </div>
                  <ArrowRightIcon />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent tasks</CardTitle>
            <CardDescription>Latest work across your projects.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <LoadingRows />
            ) : tasks.length === 0 ? (
              <Empty text="No tasks to show." />
            ) : (
              tasks.slice(0, 6).map((task) => (
                <div
                  key={task._id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(task.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Status value={task.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
function LoadingRows() {
  return (
    <>
      {[1, 2, 3].map((item) => (
        <div key={item} className="space-y-2 rounded-xl border p-4">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
      {value.replaceAll("_", " ")}
    </span>
  );
}
