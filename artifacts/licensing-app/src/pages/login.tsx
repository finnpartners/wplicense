import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthMutations } from "@/hooks/use-api-wrappers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Loader2 } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuthMutations();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = (data: LoginForm) => {
    login.mutate({ data });
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left side - Visuals */}
      <div className="hidden lg:flex w-1/2 relative bg-slate-950 overflow-hidden items-center justify-center">
        <img 
          src={`${import.meta.env.BASE_URL}images/login-bg.png`} 
          alt="Abstract background" 
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
        
        <div className="relative z-10 p-12 max-w-lg text-white">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-8 shadow-2xl shadow-indigo-600/30">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-display font-bold leading-tight mb-6">
            FINN Licensing<br/>Infrastructure
          </h1>
          <p className="text-slate-300 text-xl leading-relaxed">
            Secure, centralized management for all your WordPress plugins, clients, and API deployments.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="lg:hidden w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-600/30">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          
          <h2 className="text-3xl font-display font-bold text-slate-950 mb-2">Welcome back</h2>
          <p className="text-slate-500 mb-8">Sign in to the admin dashboard</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
              <Input 
                {...register("username")} 
                placeholder="Enter your username" 
                className={errors.username ? "border-rose-300 focus-visible:ring-rose-500/10 focus-visible:border-rose-500" : ""}
              />
              {errors.username && <p className="text-rose-500 text-xs mt-1.5 font-medium">{errors.username.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <Input 
                type="password" 
                {...register("password")} 
                placeholder="••••••••" 
                className={errors.password ? "border-rose-300 focus-visible:ring-rose-500/10 focus-visible:border-rose-500" : ""}
              />
              {errors.password && <p className="text-rose-500 text-xs mt-1.5 font-medium">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full text-base h-12 mt-4" disabled={login.isPending}>
              {login.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
            </Button>
          </form>
          
          <div className="mt-8 text-center text-sm text-slate-400">
            Internal system. Authorized access only.
          </div>
        </div>
      </div>
    </div>
  );
}
