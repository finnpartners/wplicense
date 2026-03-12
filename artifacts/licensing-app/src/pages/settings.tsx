import { useState } from "react";
import { PageHeader } from "@/components/layout/AppLayout";
import { useGetSettings } from "@workspace/api-client-react";
import { useSettingsMutations } from "@/hooks/use-api-wrappers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Copy, Check, RefreshCw, Shield, Github } from "lucide-react";

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const { update, regenerate } = useSettingsMutations();
  const [githubToken, setGithubToken] = useState("");
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  const copyApiKey = () => {
    if (settings?.apiKey) {
      navigator.clipboard.writeText(settings.apiKey);
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    }
  };

  const saveGithubToken = () => {
    if (githubToken.trim()) {
      update.mutate({ data: { githubToken: githubToken.trim() } }, {
        onSuccess: () => setGithubToken(""),
      });
    }
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-10 bg-slate-200 w-1/4 rounded"></div>
      <div className="h-48 bg-slate-200 rounded-2xl"></div>
      <div className="h-48 bg-slate-200 rounded-2xl"></div>
    </div>;
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage API keys and integrations"
      />

      <div className="space-y-8 max-w-2xl">
        <Card className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-indigo-100 text-indigo-600">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Global API Key</h3>
              <p className="text-sm text-slate-500 mt-1">Used by the dashboard plugin to fetch available products. Include this as a Bearer token in the Authorization header.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
            <code className="flex-1 font-mono text-sm text-slate-900 break-all">{settings?.apiKey || "..."}</code>
            <Button variant="outline" size="icon" onClick={copyApiKey} className="shrink-0">
              {apiKeyCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Regenerate the API key? The old key will stop working immediately.")) {
                regenerate.mutate();
              }
            }}
            disabled={regenerate.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${regenerate.isPending ? 'animate-spin' : ''}`} />
            Regenerate Key
          </Button>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-slate-100 text-slate-600">
              <Github className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">GitHub Personal Access Token</h3>
              <p className="text-sm text-slate-500 mt-1">Required to poll private repositories for releases and proxy downloads. Token is stored encrypted.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className={`text-sm font-medium ${settings?.hasGithubToken ? 'text-emerald-600' : 'text-amber-600'}`}>
              {settings?.hasGithubToken ? "Token is configured" : "No token configured"}
            </span>
          </div>

          <div className="flex gap-2">
            <Input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder={settings?.hasGithubToken ? "Enter new token to replace..." : "ghp_xxxxxxxxxxxxx"}
              className="flex-1"
            />
            <Button
              onClick={saveGithubToken}
              disabled={!githubToken.trim() || update.isPending}
            >
              {update.isPending ? "Saving..." : "Save Token"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
