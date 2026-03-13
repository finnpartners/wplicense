import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/AppLayout";
import { useGetDashboard } from "@workspace/api-client-react";
import { Users, Package, Key, ShieldCheck, Copy, Check, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function StatCard({ title, value, icon: Icon, colorClass }: { title: string; value: number; icon: LucideIcon; colorClass: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div className={cn("p-3 rounded-2xl", colorClass)}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        <div>
          <div className="text-4xl font-display font-bold text-slate-900 mb-1">{value}</div>
          <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</div>
        </div>
      </div>
    </Card>
  );
}

function ApiKeyCard() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/admin/api-key`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setApiKey(d.apiKey || ""))
      .catch(() => setApiKey(""));
  }, []);

  const handleCopy = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-lg text-slate-900">FINN API Key</h3>
          <p className="text-sm text-slate-500">Use this key in the WordPress FINN DEV Dashboard settings.</p>
        </div>
      </div>
      {apiKey === null ? (
        <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
      ) : apiKey ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-slate-100 text-sm font-mono px-4 py-2.5 rounded-lg text-slate-700 select-all truncate">
            {apiKey}
          </code>
          <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0 h-10 px-3">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>
      ) : (
        <p className="text-sm text-amber-600 bg-amber-50 px-4 py-2.5 rounded-lg">
          No FINN API Key configured. Set the <code className="font-mono font-semibold">FINN_API_KEY</code> environment variable.
        </p>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useGetDashboard();

  if (isLoading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-10 bg-slate-200 w-1/4 rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-40 bg-slate-200 rounded-2xl"></div>)}
      </div>
    </div>;
  }

  return (
    <div>
      <PageHeader 
        title="Overview" 
        description="System metrics and activity summary" 
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Clients" 
          value={data?.clientCount || 0} 
          icon={Users} 
          colorClass="bg-blue-100 text-blue-600"
        />
        <StatCard 
          title="Products" 
          value={data?.productCount || 0} 
          icon={Package} 
          colorClass="bg-fuchsia-100 text-fuchsia-600"
        />
        <StatCard 
          title="Total Licenses" 
          value={data?.licenseCount || 0} 
          icon={Key} 
          colorClass="bg-indigo-100 text-indigo-600"
        />
        <StatCard 
          title="Active Licenses" 
          value={data?.activeLicenseCount || 0} 
          icon={ShieldCheck} 
          colorClass="bg-emerald-100 text-emerald-600"
        />
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-6">API Key</h2>
        <ApiKeyCard />
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-indigo-500" onClick={() => window.location.href='/clients'}>
             <h3 className="font-bold text-lg mb-2">Issue New License</h3>
             <p className="text-slate-500 text-sm">Create and assign a new license key for a client deployment.</p>
           </Card>
           <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-fuchsia-500" onClick={() => window.location.href='/products'}>
             <h3 className="font-bold text-lg mb-2">Update Products</h3>
             <p className="text-slate-500 text-sm">Sync GitHub for the latest releases of registered plugins.</p>
           </Card>
           <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500" onClick={() => window.location.href='/clients'}>
             <h3 className="font-bold text-lg mb-2">Manage Clients</h3>
             <p className="text-slate-500 text-sm">Add or edit client details and view their license usage.</p>
           </Card>
        </div>
      </div>
    </div>
  );
}
