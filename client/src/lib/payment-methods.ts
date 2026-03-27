export interface PaymentMethodDef {
  value: string;
  label: string;
  region: string;
  requiresReference: boolean;
}

export const PAYMENT_METHODS: PaymentMethodDef[] = [
  { value: "Cash", label: "Cash", region: "Universal", requiresReference: false },
  { value: "Bank Transfer", label: "Bank Transfer", region: "Universal", requiresReference: true },

  { value: "MTN Mobile Money", label: "MTN Mobile Money", region: "Central & West Africa", requiresReference: true },
  { value: "Orange Money", label: "Orange Money", region: "Central & West Africa", requiresReference: true },
  { value: "Airtel Money", label: "Airtel Money", region: "Central & East Africa", requiresReference: true },
  { value: "M-Pesa", label: "M-Pesa", region: "East Africa", requiresReference: true },
  { value: "Tigo Pesa", label: "Tigo Pesa", region: "East Africa", requiresReference: true },
  { value: "EcoCash", label: "EcoCash", region: "Southern Africa", requiresReference: true },

  { value: "Wave", label: "Wave", region: "West Africa", requiresReference: true },
  { value: "Moov Money", label: "Moov Money", region: "West Africa", requiresReference: true },
  { value: "Free Money", label: "Free Money", region: "West Africa", requiresReference: true },
  { value: "Opay", label: "OPay", region: "Nigeria", requiresReference: true },
  { value: "PalmPay", label: "PalmPay", region: "Nigeria", requiresReference: true },
  { value: "Flutterwave", label: "Flutterwave", region: "Pan-African", requiresReference: true },
  { value: "Paystack", label: "Paystack", region: "Pan-African", requiresReference: true },
  { value: "Chipper Cash", label: "Chipper Cash", region: "Pan-African", requiresReference: true },

  { value: "Visa/Mastercard", label: "Visa / Mastercard", region: "International", requiresReference: true },
];

export const PAYMENT_REGIONS = [...new Set(PAYMENT_METHODS.map(m => m.region))];

export function getMethodDef(value: string): PaymentMethodDef {
  return PAYMENT_METHODS.find(m => m.value === value) || { value, label: value, region: "Other", requiresReference: false };
}
