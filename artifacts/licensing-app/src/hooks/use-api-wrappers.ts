import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  useLogin,
  useLogout,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  getListClientsQueryKey,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  usePollProduct,
  getListProductsQueryKey,
  getGetProductQueryKey,
  getListProductReleasesQueryKey,
  useCreateLicense,
  useUpdateLicense,
  useDeleteLicense,
  useToggleLicense,
  getListLicensesQueryKey,
  useUpdateSettings,
  useRegenerateApiKey,
  getGetSettingsQueryKey,
  getGetDashboardQueryKey
} from "@workspace/api-client-react";

// Centralized wrappers to automatically handle TanStack Query invalidation and Toasts
function extractError(err: any) {
  return err?.message || "An unexpected error occurred";
}

export function useAuthMutations() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const loginMutation = useLogin({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries();
        toast({ title: "Welcome back!", variant: "success" });
        setLocation("/dashboard");
      },
      onError: (err) => toast({ title: "Login failed", description: extractError(err), variant: "destructive" }),
    },
  });

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        qc.clear();
        setLocation("/login");
      },
    },
  });

  return { login: loginMutation, logout: logoutMutation };
}

export function useClientMutations() {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };
  const onError = (err: any) => toast({ title: "Error", description: extractError(err), variant: "destructive" });

  return {
    create: useCreateClient({ mutation: { onSuccess: () => { onSuccess(); toast({ title: "Client created", variant: "success" }) }, onError } }),
    update: useUpdateClient({ mutation: { onSuccess: () => { onSuccess(); toast({ title: "Client updated", variant: "success" }) }, onError } }),
    remove: useDeleteClient({ mutation: { onSuccess: () => { onSuccess(); toast({ title: "Client deleted" }) }, onError } }),
  };
}

export function useProductMutations() {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };
  const onPollSuccess = (productId?: number) => {
    onSuccess();
    if (productId) {
      qc.invalidateQueries({ queryKey: getGetProductQueryKey(productId) });
      qc.invalidateQueries({ queryKey: getListProductReleasesQueryKey(productId) });
    }
  };
  const onError = (err: any) => toast({ title: "Error", description: extractError(err), variant: "destructive" });

  return {
    create: useCreateProduct({ mutation: { onSuccess: () => { onSuccess(); toast({ title: "Product created", variant: "success" }) }, onError } }),
    update: useUpdateProduct({ mutation: { onSuccess: () => { onSuccess(); toast({ title: "Product updated", variant: "success" }) }, onError } }),
    remove: useDeleteProduct({ mutation: { onSuccess: () => { onSuccess(); toast({ title: "Product deleted" }) }, onError } }),
    poll: usePollProduct({ 
      mutation: { 
        onSuccess: (data, variables) => { 
          onPollSuccess(variables.id); 
          if(data.success) toast({ title: "Polling complete", description: data.message, variant: "success" });
          else toast({ title: "Polling failed", description: data.message, variant: "destructive" });
        }, 
        onError 
      } 
    }),
  };
}

export function useLicenseMutations(onCreated?: (key: string) => void) {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: getListLicensesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };
  const onError = (err: any) => toast({ title: "Error", description: extractError(err), variant: "destructive" });

  return {
    create: useCreateLicense({ 
      mutation: { 
        onSuccess: (data) => { 
          onSuccess(); 
          toast({ title: "License created", variant: "success" });
          if(onCreated) onCreated(data.licenseKey);
        }, 
        onError 
      } 
    }),
    update: useUpdateLicense({ mutation: { onSuccess: () => { onSuccess(); toast({ title: "License updated", variant: "success" }) }, onError } }),
    remove: useDeleteLicense({ mutation: { onSuccess: () => { onSuccess(); toast({ title: "License deleted" }) }, onError } }),
    toggle: useToggleLicense({ mutation: { onSuccess: () => { onSuccess(); toast({ title: "License status changed" }) }, onError } }),
  };
}

export function useSettingsMutations() {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const onSuccess = () => qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
  const onError = (err: any) => toast({ title: "Error", description: extractError(err), variant: "destructive" });

  return {
    update: useUpdateSettings({ mutation: { onSuccess: () => { onSuccess(); toast({ title: "Settings saved", variant: "success" }) }, onError } }),
    regenerate: useRegenerateApiKey({ mutation: { onSuccess: () => { onSuccess(); toast({ title: "API Key regenerated", variant: "success" }) }, onError } }),
  };
}
