import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertExpenditure } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useExpenditures() {
  return useQuery({
    queryKey: [api.expenditures.list.path],
    queryFn: async () => {
      const res = await fetch(api.expenditures.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expenditures");
      return api.expenditures.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateExpenditure() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertExpenditure) => {
      const res = await fetch(api.expenditures.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to record expenditure");
      return api.expenditures.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenditures.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Recorded", description: "Expenditure saved successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
