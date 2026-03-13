import { useState, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Package, Settings, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetMe } from "@workspace/api-client-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/products", label: "Products", icon: Package },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: user } = useGetMe();

  const SidebarContent = () => (
    <>
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="11" width="18" height="11" rx="3" stroke="white" strokeWidth="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="font-display font-bold text-lg text-white tracking-wide leading-tight">FINN</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold leading-tight">Licensing</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-3">Management</div>
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
              <span className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
                isActive 
                  ? "bg-indigo-600 text-white shadow-md" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              )}>
                <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive && "text-indigo-200")} />
                <span className="font-medium">{item.label}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 lg:hidden animate-in fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] lg:static lg:translate-x-0 shadow-2xl lg:shadow-none",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100">
              <Menu className="w-6 h-6" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-900">{user?.email ?? user?.name}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-100 border-2 border-indigo-200 flex items-center justify-center text-indigo-700 font-bold font-display">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-950 tracking-tight">{title}</h1>
        {description && <p className="text-slate-500 mt-2 text-lg">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
