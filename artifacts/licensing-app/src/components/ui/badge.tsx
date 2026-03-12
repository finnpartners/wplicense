import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-indigo-100 text-indigo-700",
    secondary: "border-transparent bg-slate-100 text-slate-700",
    destructive: "border-transparent bg-rose-100 text-rose-700",
    success: "border-transparent bg-emerald-100 text-emerald-700",
    outline: "text-slate-950",
  };

  return (
    <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2", variants[variant], className)} {...props} />
  )
}

export { Badge }
