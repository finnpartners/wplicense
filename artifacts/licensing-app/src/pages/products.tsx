import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/AppLayout";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { useProductMutations } from "@/hooks/use-api-wrappers";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Package, RefreshCw, Github, Search, Lock } from "lucide-react";
import { formatDate } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const productSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
  githubRepo: z.string().min(1, "GitHub Repo is required"),
});
type ProductForm = z.infer<typeof productSchema>;

interface GitHubRepo {
  fullName: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  alreadyAdded: boolean;
}

export default function Products() {
  const [, navigate] = useLocation();
  const { data: products, isLoading } = useListProducts();
  const { create, update, remove, poll } = useProductMutations();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [pollingAll, setPollingAll] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAdmin = useIsAdmin();

  const handlePollAll = async () => {
    setPollingAll(true);
    try {
      const res = await fetch(`${BASE}/api/admin/products/poll-all`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({ title: "All products checked", description: data.message, variant: "success" });
      } else {
        toast({ title: "Error", description: data.message || "Failed to check products", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to connect to server", variant: "destructive" });
    } finally {
      setPollingAll(false);
    }
  };
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema)
  });

  const openCreate = () => {
    setEditingId(null);
    reset({ slug: "", githubRepo: "" });
    setDialogOpen(true);
  };

  const openEdit = (product: any) => {
    setEditingId(product.id);
    reset({
      slug: product.slug,
      githubRepo: product.githubRepo,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: ProductForm) => {
    if (editingId) {
      update.mutate({ id: editingId, data }, { onSuccess: () => setDialogOpen(false) });
    } else {
      create.mutate({ data }, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const handleImport = (repo: GitHubRepo) => {
    const slug = repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    create.mutate(
      { data: { slug, githubRepo: repo.fullName } },
      { onSuccess: () => setImportOpen(false) }
    );
  };

  return (
    <div>
      <PageHeader 
        title="Products" 
        description="Register repositories to distribute"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handlePollAll}
              disabled={!isAdmin || pollingAll}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${pollingAll ? 'animate-spin' : ''}`} />
              {pollingAll ? "Checking..." : "Check All"}
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)} disabled={!isAdmin}>
              <Github className="w-4 h-4 mr-2" /> Import from GitHub
            </Button>
            <Button onClick={openCreate} disabled={!isAdmin}>
              <Plus className="w-4 h-4 mr-2" /> Add Product
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="animate-pulse h-64 bg-white rounded-2xl border border-slate-200"></div>
      ) : products?.length === 0 ? (
        <div className="text-center py-24 px-4 bg-white rounded-3xl border border-slate-200/60 shadow-sm">
          <div className="w-20 h-20 bg-fuchsia-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-fuchsia-400" />
          </div>
          <h3 className="text-xl font-display font-bold text-slate-900">No products found</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-8">Register a GitHub repository to distribute as a licensed WordPress plugin.</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => setImportOpen(true)} disabled={!isAdmin}>
              <Github className="w-4 h-4 mr-2" /> Import from GitHub
            </Button>
            <Button onClick={openCreate} disabled={!isAdmin}>Add Manually</Button>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plugin</TableHead>
              <TableHead>GitHub Repo</TableHead>
              <TableHead>Latest Version</TableHead>
              <TableHead>Last Checked</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products?.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <button
                    onClick={() => navigate(`/products/${product.id}`)}
                    className="text-left hover:underline"
                  >
                    <div className="font-semibold text-slate-900">{product.name}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{product.slug}</div>
                  </button>
                </TableCell>
                <TableCell>
                  <a href={`https://github.com/${product.githubRepo}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-indigo-600 transition-colors">
                    <Github className="w-4 h-4" />
                    {product.githubRepo}
                  </a>
                </TableCell>
                <TableCell>
                  {product.latestVersion ? (
                    <Badge variant="success" className="font-mono">{product.latestVersion}</Badge>
                  ) : (
                    <span className="text-slate-400 text-sm">Unknown</span>
                  )}
                </TableCell>
                <TableCell className="text-slate-500 text-xs">
                  {formatDate(product.lastChecked)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => poll.mutate({ id: product.id })}
                      disabled={!isAdmin || (poll.isPending && poll.variables?.id === product.id)}
                      className="h-8 px-3"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${poll.isPending && poll.variables?.id === product.id ? 'animate-spin' : ''}`} />
                      Check Now
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(product)} disabled={!isAdmin}>
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(product.id)} disabled={!isAdmin}>
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Slug *</label>
              <Input {...register("slug")} placeholder="my-awesome-plugin" className={errors.slug ? "border-rose-300" : ""} />
              <p className="text-xs text-slate-500 mt-1">Used as the product name and unique identifier.</p>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">GitHub Repository *</label>
              <Input {...register("githubRepo")} placeholder="owner/repo" className={errors.githubRepo ? "border-rose-300 font-mono" : "font-mono"} />
              <p className="text-xs text-slate-500 mt-1">Format: owner/repo. Used to sync releases.</p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>Save Product</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ImportGitHubDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
        importing={create.isPending}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Delete Product"
        description="Are you sure you want to delete this product? All associated releases will be removed, and licenses tied specifically to this product will become unrestricted."
        confirmLabel="Delete Product"
        onConfirm={() => { if (deleteId) remove.mutate({ id: deleteId }); }}
        loading={remove.isPending}
      />
    </div>
  );
}

function ImportGitHubDialog({
  open,
  onOpenChange,
  onImport,
  importing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (repo: GitHubRepo) => void;
  importing: boolean;
}) {
  const [allRepos, setAllRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hasFetched, setHasFetched] = useState(false);

  const fetchRepos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/admin/github/repos`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to fetch repositories");
        setAllRepos([]);
        return;
      }
      const data = await res.json();
      setAllRepos(data);
      setHasFetched(true);
    } catch {
      setError("Failed to connect to server");
      setAllRepos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !hasFetched) {
      fetchRepos();
    }
    if (open) {
      setSearch("");
    }
  }, [open, hasFetched, fetchRepos]);

  const available = allRepos.filter((r) => !r.alreadyAdded);

  const filtered = search
    ? available.filter((r) => {
        const q = search.toLowerCase();
        return (
          r.fullName.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q))
        );
      })
    : available;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from GitHub</DialogTitle>
        </DialogHeader>
        <div className="mt-2 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="mt-3 max-h-80 overflow-y-auto overflow-x-hidden border border-slate-200 rounded-xl divide-y divide-slate-100">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
              </div>
            )}

            {error && (
              <div className="p-4 text-center text-sm text-rose-600">{error}</div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">
                No repositories found.
              </div>
            )}

            {!loading && !error && filtered.map((repo) => (
              <div
                key={repo.fullName}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Github className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="font-mono text-sm font-medium text-slate-900 truncate">{repo.fullName}</span>
                    {repo.isPrivate && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                  </div>
                  {repo.description && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate ml-6">{repo.description}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-7 px-3 text-xs"
                  onClick={() => onImport(repo)}
                  disabled={importing}
                >
                  Import
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
