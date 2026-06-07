import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";

function normalizePhone(phone?: string | null): string | null {
  const cleaned = (phone || "").replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  return cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
}

export function SupportWhatsAppButton() {
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/public/support-settings"],
    retry: false,
  });
  const phone = normalizePhone(settings?.phone || settings?.phone2);
  if (!phone) return null;

  const message = encodeURIComponent("Hello, I need help with XpressPro.");
  return (
    <a
      href={`https://wa.me/${phone}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact support on WhatsApp"
      className="fixed bottom-5 right-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      data-testid="button-whatsapp-support"
    >
      <MessageCircle className="h-6 w-6" aria-hidden="true" />
    </a>
  );
}
