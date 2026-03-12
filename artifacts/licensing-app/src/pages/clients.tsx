import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/AppLayout";
import { useListClients, useListLicenses, useListProducts } from "@workspace/api-client-react";
import { useClientMutations, useLicenseMutations } from "@/hooks/use-api-wrappers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Users, Key, Copy, Check, ToggleLeft, ToggleRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable(),
});
type ClientForm = z.infer<typeof clientSchema>;

const licenseSchema = z.object({
  clientId: z.coerce.number().optional().nullable(),
  domain: z.string().min(1, "Domain is required"),
  pluginAccess: z.enum(["all", "specific"]),
  productIds: z.array(z.number()).optional().nullable(),
  status: z.enum(["active", "revoked"]).optional(),
});
type LicenseForm = z.infer<typeof licenseSchema>;

export default function Clients() {
  const { data: clients, isLoading: clientsLoading } = useListClients();
  const { data: licenses, isLoading: licensesLoading } = useListLicenses();
  const { data: products } = useListProducts();
  const clientMutations = useClientMutations();

  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);

  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);
  const [editingLicenseId, setEditingLicenseId] = useState<number | null>(null);
  const [licenseForClientId, setLicenseForClientId] = useState<number | null>(null);
  const [newLicenseKey, setNewLicenseKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const licenseMutations = useLicenseMutations((key) => {
    setNewLicenseKey(key);
    setLicenseDialogOpen(false);
  });

  const clientForm = useForm<ClientForm>({ resolver: zodResolver(clientSchema) });
  const licenseForm = useForm<LicenseForm>({
    resolver: zodResolver(licenseSchema),
    defaultValues: { pluginAccess: "all", productIds: [] },
  });
  const pluginAccess = licenseForm.watch("pluginAccess");

  const openCreateClient = () => {
    setEditingClientId(null);
    clientForm.reset({ name: "", email: "", notes: "" });
    setClientDialogOpen(true);
  };

  const openEditClient = (client: { id: number; name: string; email?: string | null; notes?: string | null }) => {
    setEditingClientId(client.id);
    clientForm.reset({
      name: client.name,
      email: client.email || "",
      notes: client.notes || "",
    });
    setClientDialogOpen(true);
  };

  const onClientSubmit = (data: ClientForm) => {
    if (editingClientId) {
      clientMutations.update.mutate({ id: editingClientId, data }, { onSuccess: () => setClientDialogOpen(false) });
    } else {
      clientMutations.create.mutate({ data }, {
        onSuccess: (result) => {
          setClientDialogOpen(false);
          openCreateLicense(result.id);
        }
      });
    }
  };

  const openCreateLicense = (clientId?: number) => {
    setEditingLicenseId(null);
    setLicenseForClientId(clientId || null);
    licenseForm.reset({ clientId: clientId || 0, domain: "", pluginAccess: "all", productIds: [], status: "active" });
    setLicenseDialogOpen(true);
  };

  const openEditLicense = (license: { id: number; clientId?: number | null; domain: string; pluginAccess: string; productIds?: number[] | null; status: string }) => {
    setEditingLicenseId(license.id);
    setLicenseForClientId(null);
    licenseForm.reset({
      clientId: license.clientId || 0,
      domain: license.domain,
      pluginAccess: license.pluginAccess as "all" | "specific",
      productIds: license.productIds || [],
      status: license.status as "active" | "revoked",
    });
    setLicenseDialogOpen(true);
  };

  const onLicenseSubmit = (data: LicenseForm) => {
    const clientId = licenseForClientId || data.clientId;
    if (!clientId) return;

    const payload = {
      ...data,
      clientId,
      productIds: data.pluginAccess === "specific" ? data.productIds : null,
    };

    if (editingLicenseId) {
      licenseMutations.update.mutate({ id: editingLicenseId, data: payload }, { onSuccess: () => setLicenseDialogOpen(false) });
    } else {
      licenseMutations.create.mutate({ data: payload });
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
        title="Clients"
        description="Manage clients and their license keys"
        action={<Button onClick={openCreateClient}><Plus className="w-4 h-4 mr-2" /> Add Client</Button>}
      />

      {clientsLoading ? (
        <div className="animate-pulse h-48 bg-white rounded-2xl border border-slate-200"></div>
      ) : clients?.length === 0 ? (
        <div className="text-center py-24 px-4 bg-white rounded-3xl border border-slate-200/60 shadow-sm">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-xl font-display font-bold text-slate-900">No clients found</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-8">Add a client to start issuing licenses.</p>
          <Button onClick={openCreateClient}>Add First Client</Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Licenses</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients?.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-semibold text-slate-900">{client.name}</TableCell>
                <TableCell className="text-slate-600">
                  {client.email ? (
                    <a href={`mailto:${client.email}`} className="text-indigo-600 hover:text-indigo-700 hover:underline">{client.email}</a>
                  ) : "-"}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 font-bold px-2.5 py-0.5 rounded-full text-xs">
                    {client.licenseCount}
                  </span>
                </TableCell>
                <TableCell className="text-slate-500 text-xs">{formatDate(client.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditClient(client)}>
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm("Delete this client? Existing licenses will become unassigned.")) {
                        clientMutations.remove.mutate({ id: client.id });
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

      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-950 tracking-tight">Licenses</h2>
            <p className="text-slate-500 mt-1">Issue and manage license keys</p>
          </div>
          <Button onClick={() => openCreateLicense()}><Plus className="w-4 h-4 mr-2" /> Issue License</Button>
        </div>

        {licensesLoading ? (
          <div className="animate-pulse h-48 bg-white rounded-2xl border border-slate-200"></div>
        ) : licenses?.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200/60 shadow-sm">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <Key className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No licenses issued</h3>
            <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-6">Create a license to authorize a client domain.</p>
            <Button onClick={() => openCreateLicense()}>Issue First License</Button>
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
                  <TableCell className="font-semibold text-slate-900">{license.clientName || <span className="text-amber-600 font-normal">Unassigned</span>}</TableCell>
                  <TableCell className="text-slate-600">
                    <a href={`https://${license.domain}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 hover:underline">{license.domain}</a>
                  </TableCell>
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
                        onClick={() => licenseMutations.toggle.mutate({ id: license.id })}
                        title={license.status === "active" ? "Revoke" : "Activate"}
                      >
                        {license.status === "active" ? (
                          <ToggleRight className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-slate-400" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditLicense(license)}>
                        <Edit2 className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (confirm("Delete this license? This cannot be undone.")) {
                          licenseMutations.remove.mutate({ id: license.id });
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
      </div>

      {/* Client Dialog */}
      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClientId ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name *</label>
              <Input {...clientForm.register("name")} placeholder="Jane Doe" className={clientForm.formState.errors.name ? "border-rose-300" : ""} />
              {clientForm.formState.errors.name && <p className="text-rose-500 text-xs mt-1">{clientForm.formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <Input {...clientForm.register("email")} type="email" placeholder="jane@example.com" className={clientForm.formState.errors.email ? "border-rose-300" : ""} />
              {clientForm.formState.errors.email && <p className="text-rose-500 text-xs mt-1">{clientForm.formState.errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
              <textarea
                {...clientForm.register("notes")}
                className="flex w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus-visible:outline-none focus-visible:border-indigo-500 focus-visible:ring-4 focus-visible:ring-indigo-500/10 min-h-[100px] resize-y"
                placeholder="Internal notes..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setClientDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={clientMutations.create.isPending || clientMutations.update.isPending}>Save Client</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* License Dialog */}
      <Dialog open={licenseDialogOpen} onOpenChange={setLicenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLicenseId ? "Edit License" : "Issue License"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={licenseForm.handleSubmit(onLicenseSubmit)} className="space-y-4 mt-4">
            {!licenseForClientId && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Client</label>
                <Controller
                  control={licenseForm.control}
                  name="clientId"
                  render={({ field }) => (
                    <Select value={String(field.value || "")} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger>
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
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Domain *</label>
              <Input {...licenseForm.register("domain")} placeholder="example.com" className={licenseForm.formState.errors.domain ? "border-rose-300" : ""} />
              <p className="text-xs text-slate-500 mt-1">Will be normalized (strips scheme, www, trailing slash).</p>
              {licenseForm.formState.errors.domain && <p className="text-rose-500 text-xs mt-1">{licenseForm.formState.errors.domain.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Plugin Access</label>
              <Controller
                control={licenseForm.control}
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
                    control={licenseForm.control}
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

            {editingLicenseId && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
                <Controller
                  control={licenseForm.control}
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
              <Button type="button" variant="outline" onClick={() => setLicenseDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={licenseMutations.create.isPending || licenseMutations.update.isPending}>
                {editingLicenseId ? "Save Changes" : "Issue License"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* License Key Display */}
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
    </div>
  );
}
