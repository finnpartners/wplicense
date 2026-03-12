import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/AppLayout";
import { useListLicenses, useListClients, useListProducts } from "@workspace/api-client-react";
import { useLicenseMutations } from "@/hooks/use-api-wrappers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Key, Copy, Check, ToggleLeft, ToggleRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

const licenseSchema = z.object({
  clientId: z.coerce.number().min(1, "Client is required"),
  domain: z.string().min(1, "Domain is required"),
  pluginAccess: z.enum(["all", "specific"]),
  productIds: z.array(z.number()).optional().nullable(),
  status: z.enum(["active", "revoked"]).optional(),
});
type LicenseForm = z.infer<typeof licenseSchema>;

export default function Licenses() {
  const { data: licenses, isLoading } = useListLicenses();
  const { data: clients } = useListClients();
  const { data: products } = useListProducts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newLicenseKey, setNewLicenseKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { create, update, remove, toggle } = useLicenseMutations((key) => {
    setNewLicenseKey(key);
    setDialogOpen(false);
  });

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<LicenseForm>({
    resolver: zodResolver(licenseSchema),
    defaultValues: { pluginAccess: "all", productIds: [] },
  });

  const pluginAccess = watch("pluginAccess");

  const openCreate = () => {
    setEditingId(null);
    reset({ clientId: 0, domain: "", pluginAccess: "all", productIds: [], status: "active" });
    setDialogOpen(true);
  };

  const openEdit = (license: any) => {
    setEditingId(license.id);
    reset({
      clientId: license.clientId || 0,
      domain: license.domain,
      pluginAccess: license.pluginAccess,
      productIds: license.productIds || [],
      status: license.status,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: LicenseForm) => {
    const payload = {
      ...data,
      productIds: data.pluginAccess === "specific" ? data.productIds : null,
    };

    if (editingId) {
      update.mutate({ id: editingId, data: payload }, { onSuccess: () => setDialogOpen(false) });
    } else {
      create.mutate({ data: payload });
    }
  };

  const copyKey = () => {
    if (newLicenseKey) {
      navigator.clipboard.writeText(newLicenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <PageHeader
        title="Licenses"
        description="Issue and manage license keys"
        action={<Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Issue License</Button>}
      />

      {isLoading ? (
        <div className="animate-pulse h-64 bg-white rounded-2xl border border-slate-200"></div>
      ) : licenses?.length === 0 ? (
        <div className="text-center py-24 px-4 bg-white rounded-3xl border border-slate-200/60 shadow-sm">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No licenses issued</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-8">Create a license to authorize a client domain to use your plugins.</p>
          <Button onClick={openCreate}>Issue First License</Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {licenses?.map((license) => (
              <TableRow key={license.id}>
                <TableCell className="font-mono text-sm text-slate-600">{license.licenseKeyPreview}</TableCell>
                <TableCell className="font-semibold text-slate-900">{license.clientName || "-"}</TableCell>
                <TableCell className="text-slate-600">{license.domain}</TableCell>
                <TableCell>
                  <Badge variant={license.pluginAccess === "all" ? "secondary" : "outline"} className="text-xs">
                    {license.pluginAccess === "all" ? "All Plugins" : "Specific"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={license.status === "active" ? "default" : "destructive"} className="text-xs">
                    {license.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-500 text-xs">{formatDate(license.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggle.mutate({ id: license.id })}
                      title={license.status === "active" ? "Revoke" : "Activate"}
                    >
                      {license.status === "active" ? (
                        <ToggleRight className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-slate-400" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(license)}>
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm("Delete this license? This action cannot be undone.")) {
                        remove.mutate({ id: license.id });
                      }
                    }}>
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {newLicenseKey && (
        <Dialog open={!!newLicenseKey} onOpenChange={() => setNewLicenseKey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>License Key Created</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <p className="text-sm text-slate-500 mb-4">
                Copy this license key now. It will not be shown again.
              </p>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <code className="flex-1 font-mono text-sm text-slate-900 break-all">{newLicenseKey}</code>
                <Button variant="outline" size="icon" onClick={copyKey} className="shrink-0">
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit License" : "Issue License"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Client *</label>
              <Controller
                control={control}
                name="clientId"
                render={({ field }) => (
                  <Select value={String(field.value || "")} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger className={errors.clientId ? "border-rose-300" : ""}>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.clientId && <p className="text-rose-500 text-xs mt-1">{errors.clientId.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Domain *</label>
              <Input {...register("domain")} placeholder="example.com" className={errors.domain ? "border-rose-300" : ""} />
              <p className="text-xs text-slate-500 mt-1">Will be normalized (strips scheme, www, trailing slash).</p>
              {errors.domain && <p className="text-rose-500 text-xs mt-1">{errors.domain.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Plugin Access</label>
              <Controller
                control={control}
                name="pluginAccess"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plugins</SelectItem>
                      <SelectItem value="specific">Specific Plugins</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {pluginAccess === "specific" && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Products</label>
                <div className="border border-slate-200 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto bg-slate-50">
                  <Controller
                    control={control}
                    name="productIds"
                    render={({ field }) => (
                      <>
                        {products?.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(field.value || []).includes(p.id)}
                              onChange={(e) => {
                                const current = field.value || [];
                                if (e.target.checked) {
                                  field.onChange([...current, p.id]);
                                } else {
                                  field.onChange(current.filter((id: number) => id !== p.id));
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm text-slate-700">{p.name}</span>
                          </label>
                        ))}
                        {(!products || products.length === 0) && (
                          <p className="text-sm text-slate-400">No products available</p>
                        )}
                      </>
                    )}
                  />
                </div>
              </div>
            )}

            {editingId && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value || "active"} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="revoked">Revoked</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editingId ? "Save Changes" : "Issue License"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
