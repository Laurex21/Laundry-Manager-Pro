import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [accepted, setAccepted] = useState(false);

  // Store token in sessionStorage so after login we can redirect back
  useEffect(() => {
    if (token) {
      sessionStorage.setItem("pendingInviteToken", token);
    }
  }, [token]);

  // After user logs in, check for pending invite
  useEffect(() => {
    if (user) {
      const pending = sessionStorage.getItem("pendingInviteToken");
      if (pending && pending !== token) {
        setLocation(`/join/${pending}`);
      }
    }
  }, [user, token]);

  const { data: invitation, isLoading: invLoading, error } = useQuery<any>({
    queryKey: ["/api/invitations/join", token],
    queryFn: async () => {
      const res = await fetch(`/api/invitations/join/${token}`, { credentials: "include" });
      if (!res.ok) throw new Error("Invitation not found or expired");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const acceptMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invitations/accept/${token}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to accept invitation");
      }
      return res.json();
    },
    onSuccess: () => {
      sessionStorage.removeItem("pendingInviteToken");
      setAccepted(true);
      qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome to the team!", description: `You've joined ${invitation?.siteName}` });
      setTimeout(() => setLocation("/"), 2500);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (authLoading || invLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const ROLE_COLORS: Record<string, string> = {
    owner: "bg-purple-100 text-purple-700",
    manager: "bg-blue-100 text-blue-700",
    operator: "bg-green-100 text-green-700",
  };

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">You're in!</h2>
            <p className="text-muted-foreground text-sm">You've successfully joined <strong>{invitation?.siteName}</strong>. Redirecting...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground text-sm">This invitation link is invalid, expired, or has already been used.</p>
            <Button className="mt-6" onClick={() => setLocation("/")}>Go to App</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <ShieldCheck className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">You're Invited!</CardTitle>
          <CardDescription>
            <strong>{invitation.inviterName}</strong> has invited you to join their team on XpressClean.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Site</p>
                <p className="font-medium text-sm">{invitation.siteName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Organisation</p>
                <p className="font-medium text-sm">{invitation.organisationName}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Your Role</p>
              <Badge className={ROLE_COLORS[invitation.role] || ""} data-testid="badge-invite-role">
                {invitation.role}
              </Badge>
            </div>
          </div>

          {!user ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">You need to sign in or create an account to accept this invitation.</p>
              <Button
                className="w-full"
                onClick={() => setLocation("/auth")}
                data-testid="button-sign-in-to-accept"
              >
                Sign In / Register
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Accepting as <strong>{user.email}</strong>
              </p>
              <Button
                className="w-full"
                onClick={() => acceptMut.mutate()}
                disabled={acceptMut.isPending}
                data-testid="button-accept-invite"
              >
                {acceptMut.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Joining...</>
                ) : (
                  "Accept Invitation & Join Team"
                )}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setLocation("/")} data-testid="button-decline-invite">
                Decline
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
