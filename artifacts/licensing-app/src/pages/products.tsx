import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/AppLayout";
import { useListProducts } from "@workspace/api-client-react";
import { useProductMutations } from "@/hooks/use-api-wrappers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Package, RefreshCw, Github } from "lucide-react";
import { formatDate } from "@/lib/utils";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  githubRepo: z.string().min(1, "GitHub Repo is required"),
  description: z.string().optional().nullable(),
  requiresWp: z.string().optional().nullable(),
  testedWp: z.string().optional().nullable(),
  requiresPhp: z.string().optional().nullable(),
});
type ProductForm = z.infer<typeof productSchema>;

export default function Products() {
  const { data: products, isLoading } = useListProducts();
  const { create, update, remove, poll } = useProductMutations();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema)
  });

  const openCreate = () => {
    setEditingId(null);
    reset({ name: "", slug: "", githubRepo: "", description: "", requiresWp: "", testedWp: "", requiresPhp: "" });
    setDialogOpen(true);
  };

  const openEdit = (product: any) => {
    setEditingId(product.id);
    reset({
      name: product.name,
      slug: product.slug,
      githubRepo: product.githubRepo,
      description: product.description || "",
      requiresWp: product.requiresWp || "",
      testedWp: product.testedWp || "",
      requiresPhp: product.requiresPhp || "",
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

  return (
    <div>
      <PageHeader 
        title="Products" 
        description="Register WordPress plugins to distribute"
        action={<Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add Product</Button>}
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
          <Button onClick={openCreate}>Add First Product</Button>
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
                  <div className="font-semibold text-slate-900">{product.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{product.slug}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Github className="w-4 h-4" />
                    {product.githubRepo}
                  </div>
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
                      disabled={poll.isPending && poll.variables?.id === product.id}
                      className="h-8 px-3"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${poll.isPending && poll.variables?.id === product.id ? 'animate-spin' : ''}`} />
                      Check Now
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if(confirm("Delete this product? Licenses tied specifically to this product will become unrestricted.")) {
                        remove.mutate({ id: product.id });
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name *</label>
                <Input {...register("name")} placeholder="My Awesome Plugin" className={errors.name ? "border-rose-300" : ""} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Slug *</label>
                <Input {...register("slug")} placeholder="my-awesome-plugin" className={errors.slug ? "border-rose-300" : ""} />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">GitHub Repository *</label>
              <Input {...register("githubRepo")} placeholder="owner/repo" className={errors.githubRepo ? "border-rose-300 font-mono" : "font-mono"} />
              <p className="text-xs text-slate-500 mt-1">Format: owner/repo. Used to poll for releases.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
              <Input {...register("description")} placeholder="Short summary of what this plugin does" />
            </div>

            <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
               <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Requires WP</label>
                  <Input {...register("requiresWp")} placeholder="6.0" className="h-9 text-sm" />
               </div>
               <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tested WP</label>
                  <Input {...register("testedWp")} placeholder="6.4" className="h-9 text-sm" />
               </div>
               <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Requires PHP</label>
                  <Input {...register("requiresPhp")} placeholder="7.4" className="h-9 text-sm" />
               </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>Save Product</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
