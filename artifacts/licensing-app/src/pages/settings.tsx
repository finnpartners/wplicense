import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Eye, EyeOff, Github, CircleCheck, CircleX, RefreshCw, Shield, Trash2, Plus, Users } from "lucide-react";
import { useIsAdmin, useUserRoles, type UserRole } from "@/hooks/use-role";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface GitHubStatus {
  connected: boolean;
  login?: string;
  name?: string;
  rateLimit?: number | null;
  rateRemaining?: number | null;
  message?: string;
}

function GitHubStatusCard() {
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/github-status`, { credentials: "include" });
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false, message: "Failed to check status" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5 text-slate-700" />
            <h3 className="font-bold text-lg text-slate-900">GitHub Connection</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Used to sync plugin releases and proxy downloads.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={checkStatus} disabled={loading} className="h-8 px-3">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Recheck
        </Button>
      </div>

      {loading && !status ? (
        <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
      ) : status?.connected ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <CircleCheck className="w-4.5 h-4.5 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-800">Connected</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div className="text-slate-600">Account</div>
            <div className="font-medium text-slate-900">{status.name || status.login} <span className="text-slate-400 font-normal">(@{status.login})</span></div>
            {status.rateLimit != null && status.rateRemaining != null && (
              <>
                <div className="text-slate-600">API Rate Limit</div>
                <div className="font-medium text-slate-900">
                  {status.rateRemaining.toLocaleString()} / {status.rateLimit.toLocaleString()} remaining
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <CircleX className="w-4.5 h-4.5 text-red-600" />
            <span className="text-sm font-semibold text-red-800">Disconnected</span>
          </div>
          <p className="text-sm text-red-700 mt-1">{status?.message}</p>
        </div>
      )}
    </Card>
  );
}

function UserRolesCard() {
  const isAdmin = useIsAdmin();
  const { data: roles, isLoading } = useUserRoles();
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/admin/user-roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: newEmail.trim().toLowerCase(), role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Failed to add user");
        return;
      }
      setNewEmail("");
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["my-role"] });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`${BASE}/api/admin/user-roles/${deleteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["my-role"] });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-slate-700" />
          <h3 className="font-bold text-lg text-slate-900">User Roles</h3>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Control who can add, edit, and delete products, clients, and licenses. Users not listed below can view but not modify data.
        </p>
      </div>

      {isLoading ? (
        <div className="h-24 bg-slate-100 rounded-lg animate-pulse" />
      ) : roles?.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200 mb-4">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No admin users configured yet.</p>
          <p className="text-xs text-slate-400 mt-1">Add your email below to get started.</p>
        </div>
      ) : (
        <Table className="mb-4">
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              {isAdmin && <TableHead className="w-16"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.email}</TableCell>
                <TableCell>
                  <Badge variant={r.role === "admin" ? "default" : "secondary"}>
                    {r.role}
                  </Badge>
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)}>
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {isAdmin && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="user@finnpartners.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            className="flex-1"
          />
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={saving || !newEmail.trim()}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Remove User Role"
        description="Remove this user's role? They will become a viewer and lose the ability to make changes."
        confirmLabel="Remove"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </Card>
  );
}

function ApiKeyCard() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/admin/api-key`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Forbidden");
        return r.json();
      })
      .then((d) => setApiKey(d.apiKey || ""))
      .catch(() => setApiKey(""));
  }, []);

  const handleCopy = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskedKey = apiKey ? apiKey.substring(0, 4) + "\u2022".repeat(Math.max(0, apiKey.length - 8)) + apiKey.substring(apiKey.length - 4) : "";

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="font-bold text-lg text-slate-900">FINN API Key</h3>
        <p className="text-sm text-slate-500 mt-1">
          Provide this key to WordPress sites for the FINN DEV Dashboard plugin settings.
        </p>
      </div>
      {apiKey === null ? (
        <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
      ) : apiKey ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-slate-100 text-sm font-mono px-4 py-2.5 rounded-lg text-slate-700 select-all truncate">
            {visible ? apiKey : maskedKey}
          </code>
          <Button variant="outline" size="sm" onClick={() => setVisible(!visible)} className="shrink-0 h-10 px-3">
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0 h-10 px-3">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>
      ) : (
        <p className="text-sm text-amber-600 bg-amber-50 px-4 py-2.5 rounded-lg">
          No FINN API Key configured. Set the <code className="font-mono font-semibold">FINN_API_KEY</code> environment variable.
        </p>
      )}
    </Card>
  );
}

export default function Settings() {
  const isAdmin = useIsAdmin();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configuration and credentials"
      />

      <div className="space-y-6 max-w-2xl">
        {isAdmin && (
          <>
            <ApiKeyCard />
            <GitHubStatusCard />
          </>
        )}

        <UserRolesCard />
      </div>
    </div>
  );
}
