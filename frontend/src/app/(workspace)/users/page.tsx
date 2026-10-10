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
import type { User } from "@/types/api";
import { useEffect, useState } from "react";

export default function UsersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const load = (showLoading = true) => {
    if (showLoading) setLoading(true);
    return api<{ items: User[] }>("/api/users?limit=100")
      .then((data) => setItems(data.items))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (user?.platformRole !== "ADMIN") return;
    const timer = window.setTimeout(() => {
      void load(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user]);
  if (user?.platformRole !== "ADMIN")
    return (
      <p className="text-sm text-muted-foreground">Admin access required.</p>
    );
  async function deactivate(id: string) {
    await api(`/api/users/${id}/deactivate`, { method: "PATCH" });
    await load(false);
  }
  async function changePlatformRole(id: string, platformRole: User["platformRole"]) {
    await api(`/api/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ platformRole }),
    });
    await load(false);
  }
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Administration</p>
        <h1 className="mt-1 text-3xl font-bold">Users</h1>
        <p className="mt-2 text-muted-foreground">
          Manage platform access and account status.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
          <CardDescription>
            {loading
              ? "Loading accounts…"
              : `${items.length} registered accounts`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="pb-3">User</th>
                  <th className="pb-3">Platform</th>
                  <th className="pb-3">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item._id || item.id}
                    className="border-b last:border-0"
                  >
                    <td className="py-4">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.email}
                      </p>
                    </td>
                    <td>
                      <select
                        value={item.platformRole}
                        disabled={(item._id || item.id) === user.id}
                        onChange={(event) =>
                          void changePlatformRole(
                            item._id || item.id,
                            event.target.value as User["platformRole"],
                          )
                        }
                        className="h-9 rounded-md border bg-background px-2 text-sm disabled:opacity-60"
                        aria-label={`Platform role for ${item.name}`}
                      >
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-right">
                      {item.isActive && item.platformRole !== "ADMIN" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deactivate(item._id || item.id)}
                        >
                          Deactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
