import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

export default function AcceptInvitation() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [accepted, setAccepted] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [credential, setCredential] = useState("");
  const [password, setPassword] = useState("");

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
      if (!res.ok) throw new Error(t("invitation_not_found_or_expired"));
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
        throw new Error(data.message || t("failed_accept_invitation"));
      }
      return res.json();
    },
    onSuccess: () => {
      sessionStorage.removeItem("pendingInviteToken");
      setAccepted(true);
      qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: t("welcome_to_team"), description: t("joined_site", { name: invitation?.siteName }) });
      setTimeout(() => setLocation("/"), 2500);
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const onboardMut = useMutation({
    mutationFn: async () => {
      const identifier = credential.trim();
      const isEmail = identifier.includes("@");
      const res = await fetch(`/api/staff/onboard/${token}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          password,
          email: isEmail ? identifier : undefined,
          phone: isEmail ? undefined : identifier,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || t("failed_accept_invitation"));
      return data;
    },
    onSuccess: (data) => {
      sessionStorage.removeItem("pendingInviteToken");
      setAccepted(true);
      queryClient.setQueryData(["/api/auth/user"], data);
      qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: t("welcome_to_team"), description: t("joined_site", { name: invitation?.siteName }) });
      setTimeout(() => setLocation("/dashboard"), 1200);
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
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
  const loggedInAsOwner = user && user.userType !== "staff";

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t("youre_in")}</h2>
            <p className="text-muted-foreground text-sm">{t("successfully_joined")} <strong>{invitation?.siteName}</strong>. {t("redirecting")}</p>
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
            <h2 className="text-xl font-bold mb-2">{t("invalid_invitation")}</h2>
            <p className="text-muted-foreground text-sm">{t("invalid_invitation_desc")}</p>
            <Button className="mt-6" onClick={() => setLocation("/")}>{t("go_to_app")}</Button>
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
          <CardTitle className="text-2xl">{t("youre_invited")}</CardTitle>
          <CardDescription>
            {t("invited_by_prefix")} <strong>{invitation.inviterName}</strong> {t("invited_by_suffix")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t("site")}</p>
                <p className="font-medium text-sm">{invitation.siteName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t("organisation")}</p>
                <p className="font-medium text-sm">{invitation.organisationName}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{t("your_role")}</p>
              <Badge className={ROLE_COLORS[invitation.role] || ""} data-testid="badge-invite-role">
                {invitation.role}
              </Badge>
            </div>
          </div>

          {!user ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">{t("create_staff_login_description")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("first_name")}</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} data-testid="input-staff-first-name" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("last_name")}</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="input-staff-last-name" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t("email_or_phone")}</label>
                <Input
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  placeholder={invitation.identifier}
                  data-testid="input-staff-credential"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t("password")}</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  data-testid="input-staff-password"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => onboardMut.mutate()}
                disabled={onboardMut.isPending || !credential.trim() || password.length < 6}
                data-testid="button-create-staff-account"
              >
                {onboardMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("joining")}</> : t("create_staff_login")}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setLocation("/staff-login")} data-testid="button-existing-staff-login">
                {t("already_have_staff_credentials")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                {t("accepting_as")} <strong>{user.email}</strong>
              </p>
              {loggedInAsOwner ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" data-testid="owner-staff-invite-warning">
                  {t("owner_cannot_accept_staff_invitation")}
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => acceptMut.mutate()}
                  disabled={acceptMut.isPending}
                  data-testid="button-accept-invite"
                >
                  {acceptMut.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("joining")}</>
                  ) : (
                    t("accept_invitation_join_team")
                  )}
                </Button>
              )}
              <Button variant="ghost" className="w-full" onClick={() => setLocation("/")} data-testid="button-decline-invite">
                {t("decline")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
