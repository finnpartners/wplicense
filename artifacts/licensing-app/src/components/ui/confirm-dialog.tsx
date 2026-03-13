import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 bg-red-100 rounded-full">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600 mt-2">{description}</p>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            disabled={loading}
          >
            {loading ? "Deleting..." : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
