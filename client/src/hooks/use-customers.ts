import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertCustomer, type Customer } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useCustomers() {
  return useQuery({
    queryKey: [api.customers.list.path],
    queryFn: async () => {
      const res = await fetch(api.customers.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch customers");
      return api.customers.list.responses[200].parse(await res.json());
    },
  });
}

export function useCustomer(id: number) {
  return useQuery({
    queryKey: [api.customers.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.customers.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch customer");
      return api.customers.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertCustomer) => {
      const res = await fetch(api.customers.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.message || "Failed to create customer");
      }
      return api.customers.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.customers.list.path] });
      toast({ title: "Success", description: "Customer created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertCustomer>) => {
      const url = buildUrl(api.customers.update.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to update customer");
      return api.customers.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.customers.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.customers.get.path, data.id] });
      toast({ title: "Success", description: "Customer updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
