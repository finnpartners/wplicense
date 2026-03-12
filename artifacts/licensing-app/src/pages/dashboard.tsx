import { PageHeader } from "@/components/layout/AppLayout";
import { useGetDashboard } from "@workspace/api-client-react";
import { Users, Package, Key, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

// Minimal decorative chart for aesthetic "premium" feel
const dummyData = Array.from({ length: 7 }).map((_, i) => ({ value: 10 + Math.random() * 40 }));

function StatCard({ title, value, icon: Icon, colorClass, gradient }: { title: string, value: number, icon: any, colorClass: string, gradient: string }) {
  return (
    <Card className="relative overflow-hidden group">
      <div className="p-6 relative z-10">
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
      {/* Decorative background chart */}
      <div className="absolute inset-x-0 bottom-0 h-24 opacity-20 pointer-events-none transition-opacity group-hover:opacity-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dummyData}>
            <defs>
              <linearGradient id={title.replace(/\s+/g, '')} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="currentColor" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke="none" fill={`url(#${title.replace(/\s+/g, '')})`} className={gradient} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
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
          title="Total Clients" 
          value={data?.clientCount || 0} 
          icon={Users} 
          colorClass="bg-blue-100 text-blue-600"
          gradient="text-blue-500"
        />
        <StatCard 
          title="Products" 
          value={data?.productCount || 0} 
          icon={Package} 
          colorClass="bg-fuchsia-100 text-fuchsia-600"
          gradient="text-fuchsia-500"
        />
        <StatCard 
          title="Total Licenses" 
          value={data?.licenseCount || 0} 
          icon={Key} 
          colorClass="bg-indigo-100 text-indigo-600"
          gradient="text-indigo-500"
        />
        <StatCard 
          title="Active Licenses" 
          value={data?.activeLicenseCount || 0} 
          icon={ShieldCheck} 
          colorClass="bg-emerald-100 text-emerald-600"
          gradient="text-emerald-500"
        />
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-indigo-500" onClick={() => window.location.href='/licenses'}>
             <h3 className="font-bold text-lg mb-2">Issue New License</h3>
             <p className="text-slate-500 text-sm">Create and assign a new license key for a client deployment.</p>
           </Card>
           <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-fuchsia-500" onClick={() => window.location.href='/products'}>
             <h3 className="font-bold text-lg mb-2">Update Products</h3>
             <p className="text-slate-500 text-sm">Poll GitHub for the latest releases of registered plugins.</p>
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
