import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shirt, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");

  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = tab === "login"
        ? { email, password }
        : { email, password, firstName, lastName, phone, businessName };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.message || "Authentication failed", variant: "destructive" });
        return;
      }

      queryClient.setQueryData(["/api/auth/user"], data);
      setLocation("/");
    } catch {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background overflow-hidden">
      <div className="relative flex flex-col justify-between p-10 lg:p-16 bg-gradient-to-br from-primary/90 to-blue-900 text-white overflow-hidden">
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

          <div className="space-y-4 mb-8">
            {["Track orders in real-time", "Manage customer profiles", "Automated billing & receipts"].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-300" />
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>

          <a href="/calculateur" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 transition-all group" data-testid="link-calculator">
            <span className="text-xl">📊</span>
            <div>
              <p className="text-sm font-semibold">Calculateur de démarrage gratuit</p>
              <p className="text-xs text-blue-200">Estimez votre budget pressing en 2 min →</p>
            </div>
          </a>
        </div>

        <div className="relative z-10 text-sm text-blue-200 mt-10">
          © {new Date().getFullYear()} CleanEase Inc. All rights reserved.
        </div>
      </div>

      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-bold font-display tracking-tight text-foreground">
              {tab === "login" ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="text-muted-foreground">
              {tab === "login" ? "Sign in to access your dashboard" : "Set up your laundry business account"}
            </p>
          </div>

          <div className="flex bg-muted rounded-lg p-1">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${tab === "login" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
              onClick={() => setTab("login")}
              data-testid="tab-login"
            >
              Sign In
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${tab === "register" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
              onClick={() => setTab("register")}
              data-testid="tab-register"
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 bg-card border border-border rounded-2xl shadow-xl shadow-black/5 space-y-4">
            {tab === "register" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">First Name</label>
                    <Input
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Last Name</label>
                    <Input
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input
                    type="tel"
                    placeholder="+237 6XX XXX XXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Business Name</label>
                  <Input
                    placeholder="My Laundry Shop"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    data-testid="input-business-name"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{tab === "login" ? "Email or Phone Number" : "Email"}</label>
              <Input
                type={tab === "login" ? "text" : "email"}
                placeholder={tab === "login" ? "you@example.com or +237 6XX XXX XXX" : "you@example.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pr-10"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full font-semibold h-12 text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5"
              disabled={submitting}
              data-testid="button-auth-submit"
            >
              {submitting ? "Please wait..." : tab === "login" ? "Sign In" : "Create Account"}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-3">
              {tab === "login" ? (
                <>Don't have an account? <button type="button" className="text-primary font-medium hover:underline" onClick={() => setTab("register")}>Register</button></>
              ) : (
                <>Already have an account? <button type="button" className="text-primary font-medium hover:underline" onClick={() => setTab("login")}>Sign In</button></>
              )}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
