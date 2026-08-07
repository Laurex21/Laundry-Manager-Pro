import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StainTreatmentPricingInput, StainTreatmentRateInput } from "@shared/stain-treatment";
import { apiRequest } from "@/lib/queryClient";

export interface ActiveStainTreatmentPrices {
  pricingSetId: number;
  version: number;
  currency: string;
  rates: Array<StainTreatmentRateInput & { id: number }>;
  expectedPricingSetVersion: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const STAIN_TREATMENT_SETTINGS_KEY = ["/api/stain-treatment/prices"] as const;

export function useStainTreatmentPrices(enabled = true) {
  return useQuery<ActiveStainTreatmentPrices | null>({
    queryKey: STAIN_TREATMENT_SETTINGS_KEY,
    enabled,
  });
}

export function useReplaceStainTreatmentPrices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StainTreatmentPricingInput) => {
      const response = await apiRequest("PUT", "/api/stain-treatment/prices", input);
      return response.json() as Promise<ActiveStainTreatmentPrices>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(STAIN_TREATMENT_SETTINGS_KEY, data);
      queryClient.invalidateQueries({ queryKey: STAIN_TREATMENT_SETTINGS_KEY });
    },
  });
}
