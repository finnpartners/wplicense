import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const IS_PRODUCTION = import.meta.env.PROD;

export default function Login() {
  const [error, setError] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (IS_PRODUCTION) {
      setRedirecting(true);
      window.location.href = "/.auth/login/aad?post_login_redirect_uri=" + encodeURIComponent(window.location.origin + "/");
    }
  }, []);

  const handleDevLogin = async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/dev-login`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        window.location.href = `${BASE}/`;
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  };

  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 mx-4">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="11" width="18" height="11" rx="3" stroke="white" strokeWidth="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
        <h2 className="text-3xl font-display font-bold text-slate-950 mb-2 text-center">WP License</h2>
        <p className="text-slate-500 mb-8 text-center">Sign in to continue</p>

        {!error && (
          <div className="space-y-4">
            <Button
              onClick={handleDevLogin}
              className="w-full text-base h-12 gap-3"
              variant="default"
            >
              Continue as Developer
            </Button>
            <p className="text-center text-xs text-slate-400">
              Development mode — Azure Easy Auth handles authentication in production.
            </p>
          </div>
        )}

        {error && (
          <div className="text-center text-sm text-slate-500 bg-slate-50 rounded-xl p-4 border border-slate-200">
            Sign-in is not available. Please contact your administrator.
          </div>
        )}

        <div className="mt-8 text-center text-sm text-slate-400">
          Internal system. Authorized access only.
        </div>
      </div>
    </div>
  );
}
