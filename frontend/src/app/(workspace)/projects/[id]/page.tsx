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
import { api, getApiUrl, ApiError } from "@/lib/api";
import { projectRole } from "@/lib/project-access";
import type { Project, ProjectNote, Task, User } from "@/types/api";
import { ArrowLeftIcon, CheckIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

type Member = {
  _id: string;
  userId: { _id: string; name: string; email: string };
  role: string;
  joinedAt: string;
};
type Request = {
  _id: string;
  userId: { _id: string; name: string; email: string };
  requestedRole: string;
  status: string;
  createdAt: string;
};
type Activity = {
  _id: string;
  action: string;
  createdAt: string;
  actorId?: { name: string };
};
const tabs = ["Overview", "Tasks", "Team", "Activity", "Project.md"] as const;

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [markdownDraft, setMarkdownDraft] = useState("");
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const markdownSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedMarkdownProject = useRef<string | null>(null);
  const access = user?.projects.find((item) => item.projectId === id);
  const currentRole = projectRole(access);
  const isAdmin = user?.platformRole === "ADMIN";
  const canManage = isAdmin || currentRole === "PROJECT_MANAGER";
  const canEditNotes = canManage || currentRole === "TEAM_MEMBER";
  const creatorId =
    typeof project?.createdBy === "string"
      ? project.createdBy
      : project?.createdBy?._id;
  const canDeleteProject = isAdmin || currentRole === "PROJECT_MANAGER" || creatorId === user?.id;
  const load = useCallback(async () => {
    try {
      const [p, t, m, a] = await Promise.all([
        api<{ project: Project }>(`/api/projects/${id}`),
        api<{ items: Task[] }>(`/api/projects/${id}/tasks`),
        api<{ items: Member[] }>(`/api/projects/${id}/members`),
        api<{ items: Activity[] }>(`/api/projects/${id}/activity`),
      ]);
      setProject(p.project);
      setTasks(t.items);
      setMembers(m.items);
      setActivity(a.items);
      if (canManage) {
        const r = await api<{ items: Request[] }>(
          `/api/projects/${id}/access-requests?status=PENDING`,
        );
        setRequests(r.items);
      }
      if (canManage) {
        const result = await api<{ items: User[] }>(
          `/api/projects/${id}/available-users`,
        );
        setUsers(result.items);
      }
      setError("");
    } catch (value) {
      setError(
        value instanceof ApiError ? value.message : "Unable to load project",
      );
    }
  }, [canManage, id]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const counts = useMemo(
    () => ({
      todo: tasks.filter((t) => t.status === "TODO").length,
      progress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      done: tasks.filter((t) => t.status === "DONE").length,
    }),
    [tasks],
  );
  useEffect(() => {
    const socket = io(getApiUrl(), { withCredentials: true });
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("project:join", id));
    const events = [
      "project.member_added",
      "project.member_removed",
      "project.role_changed",
      "project.access_requested",
      "project.access_reviewed",
      "project.note_created",
      "project.note_deleted",
      "task.created",
      "task.updated",
      "task.assigned",
      "task.status_changed",
      "task.deleted",
      "comment.created",
      "comment.deleted",
    ];
    const reload = () => {
      void load();
    };
    events.forEach((event) => socket.on(event, reload));
    const refreshAccess = () => {
      void refresh();
    };
    socket.on("project.role_changed", refreshAccess);
    socket.on("project.member_removed", refreshAccess);
    socket.on("project.updated", (updatedProject: Project) => {
      setProject(updatedProject);
      setMarkdownDraft(updatedProject.markdownContent || "");
      setSyncMessage("Latest saved Markdown loaded");
    });
    socket.on(
      "project:markdown_change",
      (change: { projectId: string; content: string; userName: string }) => {
        if (change.projectId !== id) return;
        setMarkdownDraft(change.content);
        setSyncMessage(`${change.userName} is editing the Markdown file`);
      },
    );
    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [id, load, refresh]);
  useEffect(() => {
    if (!project || initializedMarkdownProject.current === project._id) return;
    initializedMarkdownProject.current = project._id;
    setMarkdownDraft(project.markdownContent || "");
  }, [project]);
  useEffect(() => () => {
    if (markdownSaveTimer.current) clearTimeout(markdownSaveTimer.current);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const result = await api<{ project: Project }>(`/api/projects/${id}`);
        setProject((current) => {
          if (!current || current.updatedAt === result.project.updatedAt) return current;
          setSyncMessage("Latest project notes loaded");
          return result.project;
        });
      } catch {
        // Socket.IO remains the primary sync path; the interval is only a fallback.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [id]);
  useEffect(() => {
    if (!canManage) return;
    const refreshRequests = async () => {
      try {
        const result = await api<{ items: Request[] }>(
          `/api/projects/${id}/access-requests?status=PENDING`,
        );
        setRequests(result.items);
      } catch {
        // Project-room events remain primary; polling recovers missed requests.
      }
    };
    const timer = window.setInterval(() => {
      void refreshRequests();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [canManage, id]);
  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const result = await api<{ items: Task[] }>(`/api/projects/${id}/tasks`);
        setTasks(result.items);
      } catch {
        // Realtime events remain primary; polling recovers missed task events.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [id]);
  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await api(`/api/projects/${id}/tasks`, {
      method: "POST",
      body: JSON.stringify({
        title: data.get("title"),
        assigneeId: data.get("assigneeId") || undefined,
      }),
    });
    event.currentTarget.reset();
    load();
  }
  async function createNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSavingNotes(true);
    setError("");
    try {
      const result = await api<{ project: Project }>(`/api/projects/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ content: data.get("content") }),
      });
      setProject(result.project);
      form.reset();
      setSyncMessage("Note added and shared with project members");
    } catch (value) {
      setError(value instanceof ApiError ? value.message : "Unable to add note");
      setSyncMessage("");
    } finally {
      setSavingNotes(false);
    }
  }
  async function deleteNote(noteId: string) {
    if (!window.confirm("Delete this note?")) return;
    setError("");
    try {
      await api(`/api/projects/${id}/notes/${noteId}`, { method: "DELETE" });
      setProject((current) => {
        if (!current) return current;
        if (noteId === "legacy") return { ...current, markdownContent: "" };
        return {
          ...current,
          notes: current.notes?.filter((note) => note._id !== noteId),
        };
      });
      setSyncMessage("Note deleted");
    } catch (value) {
      setError(value instanceof ApiError ? value.message : "Unable to delete note");
    }
  }
  async function persistMarkdown(content: string) {
    try {
      const result = await api<{ project: Project }>(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ markdownContent: content }),
      });
      setProject(result.project);
      setSyncMessage("Markdown saved");
    } catch (value) {
      setError(value instanceof ApiError ? value.message : "Unable to save Markdown");
    }
  }
  function changeMarkdown(content: string) {
    setMarkdownDraft(content);
    socketRef.current?.emit("project:markdown_change", { projectId: id, content });
    if (markdownSaveTimer.current) clearTimeout(markdownSaveTimer.current);
    markdownSaveTimer.current = setTimeout(() => {
      void persistMarkdown(content);
    }, 700);
  }
  function flushMarkdown() {
    if (markdownSaveTimer.current) clearTimeout(markdownSaveTimer.current);
    markdownSaveTimer.current = null;
    void persistMarkdown(markdownDraft);
  }
  function canDeleteNote(note: ProjectNote) {
    const authorId =
      typeof note.createdBy === "string" ? note.createdBy : note.createdBy._id;
    return canManage || authorId === user?.id;
  }
  async function changeStatus(task: Task, status: Task["status"]) {
    try {
      await api(`/api/tasks/${task._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, version: task.version }),
      });
      load();
    } catch (value) {
      setError(
        value instanceof ApiError && value.status === 409
          ? "This task changed elsewhere. The latest version has been loaded."
          : "Task update failed",
      );
      load();
    }
  }
  async function changeAssignee(task: Task, assigneeId: string) {
    try {
      await api(`/api/tasks/${task._id}`, {
        method: "PATCH",
        body: JSON.stringify({ assigneeId: assigneeId || null, version: task.version }),
      });
      setError("");
      await load();
    } catch (value) {
      setError(
        value instanceof ApiError && value.status === 409
          ? "This task changed elsewhere. Reloaded the latest version."
          : value instanceof ApiError
            ? value.message
            : "Task assignment failed",
      );
      await load();
    }
  }
  async function review(
    requestId: string,
    status: "APPROVED" | "REJECTED",
    role?: string,
  ) {
    await api(`/api/projects/${id}/access-requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, role }),
    });
    await refresh();
    load();
  }
  async function changeRole(userId: string, role: string) {
    await api(`/api/projects/${id}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    refresh();
    load();
  }
  async function remove(userId: string, memberName: string) {
    if (!window.confirm(`Remove ${memberName} from this project?`)) return;
    await api(`/api/projects/${id}/members/${userId}`, { method: "DELETE" });
    refresh();
    load();
  }
  async function addMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api(`/api/projects/${id}/members`, {
        method: "POST",
        body: JSON.stringify({
          userId: data.get("userId"),
          role: isAdmin ? data.get("role") : "TEAM_MEMBER",
        }),
      });
      form.reset();
      await load();
    } catch (value) {
      setError(
        value instanceof ApiError ? value.message : "Unable to add member",
      );
    }
  }
  async function deleteCurrentProject() {
    if (!project || !window.confirm(`Delete “${project.name}” and all project data?`)) return;
    try {
      await api(`/api/projects/${id}`, { method: "DELETE" });
      router.replace("/projects");
      router.refresh();
    } catch (value) {
      setError(value instanceof ApiError ? value.message : "Unable to delete project");
    }
  }
  if (error && !project) return <p className="text-destructive">{error}</p>;
  if (!project)
    return (
      <div className="space-y-5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon />
        Projects
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">
              {currentRole?.replaceAll("_", " ") || "ADMIN"}
            </span>
          </div>
          <p className="mt-2 text-muted-foreground">
            {project.description || "No project description."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Live updates enabled
          </p>
        </div>
        {canDeleteProject && (
          <Button variant="destructive" onClick={() => void deleteCurrentProject()}>
            <TrashIcon /> Delete project
          </Button>
        )}
      </div>
      {error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === item ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
          >
            {item}
            {item === "Team" && requests.length > 0
              ? ` (${requests.length})`
              : ""}
          </button>
        ))}
      </div>
      {tab === "Overview" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
          <Card>
            <CardHeader>
              <CardTitle>Project notes</CardTitle>
              <CardDescription>
                Shared notes from this project&apos;s team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {syncMessage && (
                <p className="mb-3 text-xs font-medium text-muted-foreground">
                  {syncMessage}
                </p>
              )}
              {canEditNotes && (
                <form onSubmit={createNote} className="space-y-3">
                  <textarea
                    name="content"
                    maxLength={20000}
                    required
                    className="min-h-28 w-full resize-y rounded-xl border bg-background p-4 text-sm leading-6"
                    placeholder="Write a project note…"
                  />
                  <Button type="submit" disabled={savingNotes}>
                    {savingNotes ? "Adding…" : "Add note"}
                  </Button>
                </form>
              )}
              <div className={`${canEditNotes ? "mt-6" : ""} space-y-3`}>
                {(!project.notes || project.notes.length === 0) && (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No project notes yet.
                  </div>
                )}
                {project.notes?.map((note) => (
                  <div key={note._id} className="rounded-xl border bg-muted/30 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {typeof note.createdBy === "string" ? "Project member" : note.createdBy.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(note.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {canDeleteNote(note) && (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Delete note"
                          onClick={() => void deleteNote(note._id)}
                        >
                          <TrashIcon />
                        </Button>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6">{note.content}</p>
                  </div>
                ))}
                </div>
            </CardContent>
          </Card>
          <div className="grid gap-3">
            <Metric label="Todo" value={counts.todo} />
            <Metric label="In progress" value={counts.progress} />
            <Metric label="Done" value={counts.done} />
          </div>
        </div>
      )}
      {tab === "Tasks" && (
        <div className="space-y-4">
          {canManage && (
            <Card>
              <CardContent className="p-4">
                <form onSubmit={createTask} className="grid gap-2 sm:grid-cols-[1fr_16rem_auto]">
                  <Input name="title" placeholder="New task title" required />
                  <select
                    name="assigneeId"
                    defaultValue=""
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    aria-label="Task assignee"
                  >
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.userId._id} value={member.userId._id}>
                        {member.userId.name} · {member.role.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <Button type="submit">Create task</Button>
                </form>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="divide-y p-0">
              {tasks.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No tasks yet.
                </p>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task._id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {typeof task.assigneeId === "object" && task.assigneeId
                          ? `Assigned to ${task.assigneeId.name} · `
                          : "Unassigned · "}
                        Version {task.version} · Updated{" "}
                        {new Date(task.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <TaskStatus status={task.status} />
                    {canManage && (
                      <select
                        value={
                          typeof task.assigneeId === "string"
                            ? task.assigneeId
                            : task.assigneeId?._id || ""
                        }
                        onChange={(event) =>
                          void changeAssignee(task, event.target.value)
                        }
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        aria-label={`Assignee for ${task.title}`}
                      >
                        <option value="">Unassigned</option>
                        {members.map((member) => (
                          <option key={member.userId._id} value={member.userId._id}>
                            {member.userId.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <select
                      value={task.status}
                      disabled={
                        !canManage &&
                        !(
                          currentRole === "TEAM_MEMBER" &&
                          (typeof task.assigneeId === "string"
                            ? task.assigneeId === user?.id
                            : task.assigneeId?._id === user?.id)
                        )
                      }
                      onChange={(event) =>
                        changeStatus(task, event.target.value as Task["status"])
                      }
                      className="h-9 rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="TODO">Todo</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="DONE">Done</option>
                    </select>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {tab === "Team" && (
        <div className="grid gap-6 xl:grid-cols-2">
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Add member</CardTitle>
                <CardDescription>
                  Select an active user by name and add them to this project.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={addMember} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <select
                    name="userId"
                    required
                    defaultValue=""
                    className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="" disabled>
                      Select an active user
                    </option>
                    {users.map((candidate) => (
                        <option
                          key={candidate._id || candidate.id}
                          value={candidate._id || candidate.id}
                        >
                          {candidate.name} ({candidate.email})
                        </option>
                      ))}
                  </select>
                  {isAdmin && (
                    <select
                      name="role"
                      defaultValue="TEAM_MEMBER"
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      aria-label="Project role"
                    >
                      <option value="PROJECT_MANAGER">Project Manager</option>
                      <option value="TEAM_MEMBER">Team Member</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  )}
                  <Button type="submit" disabled={users.length === 0}>Add</Button>
                </form>
              </CardContent>
            </Card>
          )}
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Access requests</CardTitle>
                <CardDescription>
                  Approve users as Team Member or Viewer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {requests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No pending requests.
                  </p>
                ) : (
                  requests.map((request) => (
                    <div key={request._id} className="rounded-xl border p-4">
                      <p className="font-medium">{request.userId.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {request.userId.email} · requested{" "}
                        {request.requestedRole.replaceAll("_", " ")}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            review(
                              request._id,
                              "APPROVED",
                              request.requestedRole,
                            )
                          }
                        >
                          <CheckIcon />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => review(request._id, "REJECTED")}
                        >
                          <XIcon />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
          {!canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Access requests</CardTitle>
                <CardDescription>
                  Only this project&apos;s Project Managers can review pending access requests.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Your current project role is {currentRole?.replaceAll("_", " ") || "not assigned"}.
                </p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Current members</CardTitle>
              <CardDescription>
                Change access level or remove a member.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.map((member) => (
                <div
                  key={member._id}
                  className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <p className="font-medium">{member.userId.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.userId.email}
                    </p>
                  </div>
                  {canManage && (member.role !== "PROJECT_MANAGER" || isAdmin) ? (
                    <>
                      <select
                        value={member.role}
                        onChange={(event) =>
                          changeRole(member.userId._id, event.target.value)
                        }
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      >
                        {user?.platformRole === "ADMIN" && (
                          <option value="PROJECT_MANAGER">
                            Project Manager
                          </option>
                        )}
                        <option value="TEAM_MEMBER">Team Member</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void remove(member.userId._id, member.userId.name)}
                      >
                        <TrashIcon /> Remove member
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs font-medium">
                      {member.role.replaceAll("_", " ")}
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
      {tab === "Activity" && (
        <Card>
          <CardHeader>
            <CardTitle>Project activity</CardTitle>
            <CardDescription>Recent actions in this project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {activity.map((item) => (
              <div
                key={item._id}
                className="flex gap-3 border-b py-4 last:border-0"
              >
                <span className="mt-2 size-2 rounded-full bg-primary" />
                <div>
                  <p className="text-sm">
                    <span className="font-medium">
                      {item.actorId?.name || "User"}
                    </span>{" "}
                    {item.action.replaceAll(".", " ").replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {tab === "Project.md" && (
        <Card>
          <CardHeader>
            <CardTitle>Shared Markdown file</CardTitle>
            <CardDescription>
              Typing is shown to everyone in this project immediately. Changes are saved automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {syncMessage && (
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                {syncMessage}
              </p>
            )}
            <textarea
              value={markdownDraft}
              onChange={(event) => changeMarkdown(event.target.value)}
              onBlur={flushMarkdown}
              readOnly={!canEditNotes}
              maxLength={20000}
              aria-label="Shared Markdown file"
              className="min-h-112 w-full resize-y rounded-xl border bg-background p-5 font-mono text-sm leading-7 read-only:cursor-default read-only:bg-muted/40"
              placeholder="# Project Markdown"
            />
            {!canEditNotes && (
              <p className="mt-2 text-xs text-muted-foreground">
                Viewers can watch live changes but cannot edit this file.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function TaskStatus({ status }: { status: Task["status"] }) {
  const styles = {
    TODO: "bg-slate-100 text-slate-700",
    IN_PROGRESS: "bg-amber-100 text-amber-800",
    DONE: "bg-emerald-100 text-emerald-800",
  }[status];
  return (
    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
