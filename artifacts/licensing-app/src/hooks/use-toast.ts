import { createContext, useContext, useState, ReactNode, createElement } from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "destructive" | "success";

interface ToastOptions {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextType {
  toast: (options: Omit<ToastOptions, "id">) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastOptions[]>([]);

  const toast = (options: Omit<ToastOptions, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...options, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  return createElement(
    ToastContext.Provider,
    { value: { toast } },
    children,
    createElement(
      "div",
      { className: "fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none" },
      toasts.map((t) =>
        createElement(
          "div",
          {
            key: t.id,
            className: cn(
              "p-4 rounded-xl shadow-xl border w-80 pointer-events-auto transition-all duration-300 animate-in slide-in-from-right-8 fade-in",
              t.variant === "destructive" && "bg-rose-50 border-rose-200 text-rose-900",
              t.variant === "success" && "bg-emerald-50 border-emerald-200 text-emerald-900",
              (!t.variant || t.variant === "default") && "bg-white border-slate-200 text-slate-900"
            )
          },
          createElement("h4", { className: "font-semibold text-sm" }, t.title),
          t.description && createElement("p", { className: "text-sm opacity-90 mt-1" }, t.description)
        )
      )
    )
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};
