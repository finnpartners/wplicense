import { Fragment, useState } from "react";
import { useParams, useLocation } from "wouter";
import { PageHeader } from "@/components/layout/AppLayout";
import { useGetProduct, useListProductReleases } from "@workspace/api-client-react";
import { useProductMutations } from "@/hooks/use-api-wrappers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Github, RefreshCw, Calendar, Tag, Download, ChevronDown, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function ProductDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const productId = parseInt(params.id || "0", 10);

  const { data: product, isLoading: productLoading } = useGetProduct(productId, {
    query: { enabled: productId > 0 },
  });
  const { data: releases, isLoading: releasesLoading } = useListProductReleases(productId, {
    query: { enabled: productId > 0 },
  });
  const { poll } = useProductMutations();

  if (productLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/3" />
        <div className="h-64 bg-white rounded-2xl border border-slate-200" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-24">
        <h3 className="text-xl font-bold text-slate-900">Product not found</h3>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/products")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Products
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={product.name}
        description={product.description || `Release history for ${product.slug}`}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => poll.mutate({ id: product.id })}
              disabled={poll.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${poll.isPending ? "animate-spin" : ""}`} />
              Sync Releases
            </Button>
            <Button variant="outline" onClick={() => navigate("/products")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <InfoCard icon={<Tag className="w-5 h-5 text-indigo-500" />} label="Latest Version" value={product.latestVersion || "—"} />
        <InfoCard icon={<Github className="w-5 h-5 text-slate-700" />} label="Repository" value={product.githubRepo} />
        <InfoCard icon={<Calendar className="w-5 h-5 text-amber-500" />} label="Last Release" value={formatDate(product.releaseDate)} />
        <InfoCard icon={<RefreshCw className="w-5 h-5 text-emerald-500" />} label="Last Checked" value={formatDate(product.lastChecked)} />
      </div>

      <h2 className="text-lg font-display font-bold text-slate-900 mb-4">
        All Releases
        {releases && <span className="text-sm font-normal text-slate-500 ml-2">({releases.length})</span>}
      </h2>

      {releasesLoading ? (
        <div className="animate-pulse h-64 bg-white rounded-2xl border border-slate-200" />
      ) : !releases || releases.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200/60 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Tag className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No releases synced yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-6">
            Click "Sync Releases" to pull all releases from GitHub.
          </p>
          <Button
            onClick={() => poll.mutate({ id: product.id })}
            disabled={poll.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${poll.isPending ? "animate-spin" : ""}`} />
            Sync Now
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Download</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {releases.map((release, idx) => {
              const isExpanded = expandedId === release.id;
              const hasChangelog = !!release.changelog;
              return (
                <Fragment key={release.id}>
                  <TableRow
                    className={hasChangelog ? "cursor-pointer" : ""}
                    onClick={() => hasChangelog && setExpandedId(isExpanded ? null : release.id)}
                  >
                    <TableCell className="w-8 pr-0">
                      {hasChangelog ? (
                        isExpanded
                          ? <ChevronDown className="w-4 h-4 text-slate-400" />
                          : <ChevronRight className="w-4 h-4 text-slate-400" />
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={idx === 0 ? "success" : "outline"} className="font-mono">
                          {release.version}
                        </Badge>
                        {idx === 0 && (
                          <span className="text-xs text-emerald-600 font-semibold">Latest</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm text-slate-600">{release.tagName}</span>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {formatDate(release.publishedAt)}
                    </TableCell>
                    <TableCell>
                      {release.downloadUrl ? (
                        <a
                          href={release.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </a>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && release.changelog && (
                    <TableRow key={`${release.id}-changelog`} className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableCell colSpan={5} className="p-0">
                        <div className="px-6 py-4 border-t border-slate-100">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Changelog</div>
                          <pre className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-auto">
                            {release.changelog}
                          </pre>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-semibold text-slate-900 truncate">{value}</p>
    </div>
  );
}
