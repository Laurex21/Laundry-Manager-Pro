import { Lock, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface UpgradePromptProps {
  title: string;
  description: string;
  requiredPlan: string;
}

export function UpgradePrompt({ title, description, requiredPlan }: UpgradePromptProps) {
  return (
    <div className="bg-card rounded-2xl border border-border p-8 text-center max-w-lg mx-auto mt-12 shadow-lg" data-testid="upgrade-prompt">
      <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
        <Lock className="w-8 h-8 text-muted-foreground" />
        <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground p-1.5 rounded-full shadow-md">
          <Sparkles className="w-4 h-4" />
        </div>
      </div>
      <h3 className="text-2xl font-bold mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground mb-8">
        {description} This feature requires the{" "}
        <span className="font-semibold text-foreground">{requiredPlan}</span> plan or higher.
      </p>
      <Link href="/subscriptions">
        <Button size="lg" className="w-full sm:w-auto font-semibold px-8 rounded-xl" data-testid="button-upgrade-plan">
          Upgrade Plan
        </Button>
      </Link>
    </div>
  );
}
