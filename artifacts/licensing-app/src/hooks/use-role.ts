import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useMyRole() {
  return useQuery<{ role: string }>({
    queryKey: ["my-role"],
    queryFn: () => fetch(`${BASE}/api/admin/my-role`, { credentials: "include" }).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useIsAdmin() {
  const { data } = useMyRole();
  return data?.role === "admin";
}

export interface UserRole {
  id: number;
  email: string;
  role: string;
  createdAt: string;
}

export function useUserRoles() {
  return useQuery<UserRole[]>({
    queryKey: ["user-roles"],
    queryFn: () => fetch(`${BASE}/api/admin/user-roles`, { credentials: "include" }).then(r => r.json()),
  });
}
