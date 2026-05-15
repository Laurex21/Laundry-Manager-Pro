import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { getSiteHeaders } from "@/lib/queryClient";

export function useStats() {
  return useQuery({
    queryKey: [api.stats.get.path],
    queryFn: async () => {
      const res = await fetch(api.stats.get.path, {
        credentials: "include",
        headers: getSiteHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.stats.get.responses[200].parse(await res.json());
    },
  });
}
