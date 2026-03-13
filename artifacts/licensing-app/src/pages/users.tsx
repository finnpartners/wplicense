import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Users } from "lucide-react";
import { useIsAdmin, useUserRoles } from "@/hooks/use-role";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function UsersPage() {
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
    <div>
      <PageHeader
        title="Users"
        description="Manage who can make changes"
      />

      <p className="text-sm text-slate-500 mb-6">
        Users with the <Badge variant="default" className="mx-1">admin</Badge> role can add, edit, and delete products, clients, and licenses. Everyone else can view but not modify data.
      </p>

      <div className="flex items-center gap-2 mb-6">
        <Input
          placeholder="user@finnpartners.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          className="flex-1"
          disabled={!isAdmin}
        />
        <Select value={newRole} onValueChange={setNewRole} disabled={!isAdmin}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} disabled={!isAdmin || saving || !newEmail.trim()}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse h-48 bg-white rounded-2xl border border-slate-200"></div>
      ) : roles?.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200/60 shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Users className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No users configured</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2">Add an email above to grant admin access.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-16"></TableHead>
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
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)} disabled={!isAdmin}>
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
    </div>
  );
}
