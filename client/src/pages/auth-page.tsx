import { Button } from "@/components/ui/button";
import { Shirt, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background overflow-hidden">
      {/* Left: Marketing */}
      <div className="relative flex flex-col justify-between p-10 lg:p-16 bg-gradient-to-br from-primary/90 to-blue-900 text-white overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-blue-400/20 blur-3xl"></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Shirt className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">CleanEase</span>
          </div>

          <h1 className="font-display font-bold text-5xl lg:text-6xl leading-tight mb-6">
            Laundry management, <br/>
            <span className="text-blue-200">simplified.</span>
          </h1>
          <p className="text-blue-100 text-lg max-w-md mb-8 leading-relaxed">
            The all-in-one platform to manage orders, customers, and operations efficiently. Spend less time on paper, more time on growth.
          </p>

          <div className="space-y-4">
            {["Track orders in real-time", "Manage customer profiles", "Automated billing & receipts"].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-300" />
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-sm text-blue-200 mt-10">
          © {new Date().getFullYear()} CleanEase Inc. All rights reserved.
        </div>
      </div>

      {/* Right: Login Action */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold font-display tracking-tight text-foreground">Welcome Back</h2>
            <p className="text-muted-foreground">Sign in to access your dashboard</p>
          </div>

          <div className="p-8 bg-card border border-border rounded-2xl shadow-xl shadow-black/5">
            <Button 
              size="lg" 
              className="w-full font-semibold h-12 text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5"
              onClick={handleLogin}
            >
              Sign In with Replit
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
