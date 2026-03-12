export function normaliseDomain(domain: string): string {
  let d = domain.trim();
  d = d.replace(/^https?:\/\//i, "");
  d = d.split("/")[0] || d;
  d = d.replace(/^www\./i, "");
  d = d.replace(/\.+$/, "");
  return d.toLowerCase();
}
