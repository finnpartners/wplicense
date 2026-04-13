import { useState, useMemo, useEffect } from "react";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Users, Key, Copy, Check, ToggleLeft, ToggleRight, Monitor, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-role";
import { useQuery } from "@tanstack/react-query";

const PAGE_SIZE = 10;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DomainPlugin {
  id: number;
  licenseId: number;
  productId: number;
  domain: string;
  currentVersion: string | null;
  lastCheckedAt: string;
  productName: string | null;
  productSlug: string | null;
  latestVersion: string | null;
}

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
  const isAdmin = useIsAdmin();

  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);

  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);
  const [editingLicenseId, setEditingLicenseId] = useState<number | null>(null);
  const [licenseForClientId, setLicenseForClientId] = useState<number | null>(null);
  const [newLicenseKey, setNewLicenseKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [domainPluginsOpen, setDomainPluginsOpen] = useState(false);
  const [domainPluginsDomain, setDomainPluginsDomain] = useState<string | null>(null);
  const [pingSiteLoading, setPingSiteLoading] = useState(false);
  const [pingSiteError, setPingSiteError] = useState<string | null>(null);
  const [pingSiteSuccess, setPingSiteSuccess] = useState<string | null>(null);
  const [deleteClientId, setDeleteClientId] = useState<number | null>(null);
  const [deleteLicenseId, setDeleteLicenseId] = useState<number | null>(null);
  const [clientPage, setClientPage] = useState(0);
  const [licensePage, setLicensePage] = useState(0);

  const sortedClients = useMemo(() => {
    if (!clients) return [];
    return [...clients].sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);

  const sortedLicenses = useMemo(() => {
    if (!licenses) return [];
    return [...licenses].sort((a, b) => (a.clientName || "").localeCompare(b.clientName || ""));
  }, [licenses]);

  const clientPageCount = Math.max(1, Math.ceil(sortedClients.length / PAGE_SIZE));
  const pagedClients = sortedClients.slice(clientPage * PAGE_SIZE, (clientPage + 1) * PAGE_SIZE);

  const licensePageCount = Math.max(1, Math.ceil(sortedLicenses.length / PAGE_SIZE));
  const pagedLicenses = sortedLicenses.slice(licensePage * PAGE_SIZE, (licensePage + 1) * PAGE_SIZE);

  useEffect(() => {
    if (clientPage >= clientPageCount) setClientPage(Math.max(0, clientPageCount - 1));
  }, [clientPage, clientPageCount]);

  useEffect(() => {
    if (licensePage >= licensePageCount) setLicensePage(Math.max(0, licensePageCount - 1));
  }, [licensePage, licensePageCount]);

  const { data: domainPlugins, refetch: refetchDomainPlugins, isFetching: domainPluginsFetching } = useQuery<DomainPlugin[]>({
    queryKey: ["domain-plugins"],
    queryFn: () => fetch(`${BASE}/api/admin/domain-plugins`, { credentials: "include" }).then(r => r.json()),
  });

  const licenseMutations = useLicenseMutations((key) => {
    setNewLicenseKey(key);
    setLicenseDialogOpen(false);
  });

  const clientForm = useForm<ClientForm>({
    resolver: zodResolver(clientSchema) as any,
  });
  const licenseForm = useForm<LicenseForm>({
    resolver: zodResolver(licenseSchema) as any,
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

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const openDomainPlugins = (domain: string) => {
    setDomainPluginsDomain(domain);
    setDomainPluginsOpen(true);
    setPingSiteError(null);
    setPingSiteSuccess(null);
  };

  const handlePingSite = async () => {
    if (!domainPluginsDomain) return;
    setPingSiteLoading(true);
    setPingSiteError(null);
    setPingSiteSuccess(null);
    try {
      const res = await fetch(`${BASE}/api/admin/ping-site`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainPluginsDomain }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPingSiteError(data.message || "Failed to reach site");
      } else {
        setPingSiteSuccess(`Found ${data.pluginsFound} plugin(s), updated ${data.updated}`);
        refetchDomainPlugins();
      }
    } catch {
      setPingSiteError("Network error");
    } finally {
      setPingSiteLoading(false);
    }
  };

  const filteredDomainPlugins = domainPlugins?.filter(
    (dp) => dp.domain === domainPluginsDomain
  ) ?? [];

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Manage clients and their license keys"
        action={<Button onClick={openCreateClient} disabled={!isAdmin}><Plus className="w-4 h-4 mr-2" /> Add Client</Button>}
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
          <Button onClick={openCreateClient} disabled={!isAdmin}>Add First Client</Button>
        </div>
      ) : (
        <>
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
              {pagedClients.map((client) => (
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
                      <Button variant="ghost" size="icon" onClick={() => openEditClient(client)} disabled={!isAdmin}>
                        <Pencil className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteClientId(client.id)} disabled={!isAdmin}>
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {clientPageCount > 1 && (
            <Pagination page={clientPage} pageCount={clientPageCount} total={sortedClients.length} onPageChange={setClientPage} />
          )}
        </>
      )}

      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-950 tracking-tight">Licenses</h2>
            <p className="text-slate-500 mt-1">Issue and manage license keys</p>
          </div>
          <Button onClick={() => openCreateLicense()} disabled={!isAdmin}><Plus className="w-4 h-4 mr-2" /> Issue License</Button>
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
            <Button onClick={() => openCreateLicense()} disabled={!isAdmin}>Issue First License</Button>
          </div>
        ) : (
          <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Updates</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedLicenses.map((license) => {
                const domainEntries = domainPlugins?.filter(dp => dp.domain === license.domain) ?? [];
                const outdatedCount = domainEntries.filter(
                  dp => dp.currentVersion && dp.latestVersion && dp.currentVersion !== dp.latestVersion
                ).length;
                const totalTracked = domainEntries.length;

                return (
                <TableRow key={license.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-sm text-slate-600 truncate max-w-[120px]" title={license.licenseKey}>{(license.licenseKey || "").substring(0, 8)}...</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => license.licenseKey && copyKey(license.licenseKey)}
                        title="Copy license key"
                        disabled={!isAdmin}
                      >
                        {copied === license.licenseKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900">{license.clientName || <span className="text-amber-600 font-normal">Unassigned</span>}</TableCell>
                  <TableCell className="text-slate-600">
                    <a href={`https://${license.domain}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 hover:underline">{license.domain}</a>
                  </TableCell>
                  <TableCell>
                    {totalTracked === 0 ? (
                      <button
                        onClick={() => openDomainPlugins(license.domain)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-50 text-slate-400 text-xs font-medium hover:bg-slate-100 transition-colors"
                      >
                        No data
                      </button>
                    ) : outdatedCount === 0 ? (
                      <button
                        onClick={() => openDomainPlugins(license.domain)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        All up to date
                      </button>
                    ) : outdatedCount <= 2 ? (
                      <button
                        onClick={() => openDomainPlugins(license.domain)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {outdatedCount} outdated
                      </button>
                    ) : (
                      <button
                        onClick={() => openDomainPlugins(license.domain)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-medium hover:bg-rose-100 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {outdatedCount} outdated
                      </button>
                    )}
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
                        disabled={!isAdmin}
                      >
                        {license.status === "active" ? (
                          <ToggleRight className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-slate-400" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditLicense(license)} disabled={!isAdmin}>
                        <Pencil className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteLicenseId(license.id)} disabled={!isAdmin}>
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {licensePageCount > 1 && (
            <Pagination page={licensePage} pageCount={licensePageCount} total={sortedLicenses.length} onPageChange={setLicensePage} />
          )}
          </div>
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

      {newLicenseKey && (
        <Dialog open={!!newLicenseKey} onOpenChange={() => setNewLicenseKey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>License Key Created</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <p className="text-sm text-slate-500 mb-4">
                Your new license key is ready. You can also copy it later from the license table.
              </p>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <code className="flex-1 font-mono text-sm text-slate-900 break-all">{newLicenseKey}</code>
                <Button variant="outline" size="icon" onClick={() => copyKey(newLicenseKey)} className="shrink-0">
                  {copied === newLicenseKey ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={domainPluginsOpen} onOpenChange={setDomainPluginsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Plugin Versions — {domainPluginsDomain}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between mt-1 mb-2">
            <p className="text-xs text-slate-400">Live versions from the site.</p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs shrink-0"
              onClick={handlePingSite}
              disabled={pingSiteLoading}
            >
              <RefreshCw className={`w-3 h-3 ${pingSiteLoading ? "animate-spin" : ""}`} />
              {pingSiteLoading ? "Checking..." : "Check Now"}
            </Button>
          </div>
          {pingSiteError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">{pingSiteError}</div>
          )}
          {pingSiteSuccess && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2">{pingSiteSuccess}</div>
          )}
          <div>
            {filteredDomainPlugins.length === 0 ? (
              <div className="text-center py-8">
                <Monitor className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No plugin version data yet.</p>
                <p className="text-xs text-slate-400 mt-1">No update check data has been received from this site yet.</p>
              </div>
            ) : (
              <>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {filteredDomainPlugins.map((dp) => (
                    <div key={dp.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900">{dp.productName || dp.productSlug}</div>
                        <div className="text-xs text-slate-400 mt-0.5">Last reported {formatDate(dp.lastCheckedAt)}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="font-mono text-xs">
                          v{dp.currentVersion}
                        </Badge>
                        {dp.latestVersion && dp.currentVersion && dp.currentVersion !== dp.latestVersion ? (
                          <Badge variant="destructive" className="text-xs">
                            Update available: {dp.latestVersion}
                          </Badge>
                        ) : dp.latestVersion && dp.currentVersion === dp.latestVersion ? (
                          <Badge variant="default" className="text-xs">
                            Up to date
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteClientId !== null}
        onOpenChange={(open) => { if (!open) setDeleteClientId(null); }}
        title="Delete Client"
        description="Are you sure you want to delete this client? Existing licenses will become unassigned."
        confirmLabel="Delete Client"
        onConfirm={() => { if (deleteClientId) clientMutations.remove.mutate({ id: deleteClientId }); }}
        loading={clientMutations.remove.isPending}
      />

      <ConfirmDialog
        open={deleteLicenseId !== null}
        onOpenChange={(open) => { if (!open) setDeleteLicenseId(null); }}
        title="Delete License"
        description="Are you sure you want to delete this license? This action cannot be undone and the license key will stop working immediately."
        confirmLabel="Delete License"
        onConfirm={() => { if (deleteLicenseId) licenseMutations.remove.mutate({ id: deleteLicenseId }); }}
        loading={licenseMutations.remove.isPending}
      />
    </div>
  );
}

function Pagination({ page, pageCount, total, onPageChange }: { page: number; pageCount: number; total: number; onPageChange: (p: number) => void }) {
  const from = page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);
  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <span className="text-sm text-slate-500">{from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
