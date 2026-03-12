import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/layout/AppLayout";
import { useListClients } from "@workspace/api-client-react";
import { useClientMutations } from "@/hooks/use-api-wrappers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  company: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable(),
});
type ClientForm = z.infer<typeof clientSchema>;

export default function Clients() {
  const { data: clients, isLoading } = useListClients();
  const { create, update, remove } = useClientMutations();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientForm>({
    resolver: zodResolver(clientSchema)
  });

  const openCreate = () => {
    setEditingId(null);
    reset({ name: "", company: "", email: "", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (client: any) => {
    setEditingId(client.id);
    reset({
      name: client.name,
      company: client.company || "",
      email: client.email || "",
      notes: client.notes || "",
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: ClientForm) => {
    if (editingId) {
      update.mutate({ id: editingId, data }, { onSuccess: () => setDialogOpen(false) });
    } else {
      create.mutate({ data }, { onSuccess: () => setDialogOpen(false) });
    }
  };

  return (
    <div>
      <PageHeader 
        title="Clients" 
        description="Manage your customer accounts"
        action={<Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add Client</Button>}
      />

      {isLoading ? (
        <div className="animate-pulse h-64 bg-white rounded-2xl border border-slate-200"></div>
      ) : clients?.length === 0 ? (
        <div className="text-center py-24 px-4 bg-white rounded-3xl border border-slate-200/60 shadow-sm">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-xl font-display font-bold text-slate-900">No clients found</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-8">You haven't added any clients yet. Add a client to start issuing licenses.</p>
          <Button onClick={openCreate}>Add First Client</Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
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
                <TableCell className="text-slate-600">{client.company || "-"}</TableCell>
                <TableCell className="text-slate-600">{client.email || "-"}</TableCell>
                <TableCell>
                   <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 font-bold px-2.5 py-0.5 rounded-full text-xs">
                     {client.licenseCount}
                   </span>
                </TableCell>
                <TableCell className="text-slate-500 text-xs">{formatDate(client.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(client)}>
                      <Edit2 className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if(confirm("Are you sure? This will not delete licenses but may orphan them.")) {
                        remove.mutate({ id: client.id });
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
            <DialogTitle>{editingId ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name *</label>
              <Input {...register("name")} placeholder="Jane Doe" className={errors.name ? "border-rose-300" : ""} />
              {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company</label>
              <Input {...register("company")} placeholder="Acme Corp" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <Input {...register("email")} type="email" placeholder="jane@example.com" className={errors.email ? "border-rose-300" : ""} />
              {errors.email && <p className="text-rose-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
              <textarea 
                {...register("notes")} 
                className="flex w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus-visible:outline-none focus-visible:border-indigo-500 focus-visible:ring-4 focus-visible:ring-indigo-500/10 min-h-[100px] resize-y"
                placeholder="Internal notes..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>Save Client</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
