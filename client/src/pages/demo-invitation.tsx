import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptDemoInvitation, readDemoInvitation } from "@/lib/demo-invitations";
import { isDemoMode } from "@/lib/demo-mode";

export default function DemoInvitationPage() {
  const { t } = useTranslation();
  const { token = "" } = useParams<{ token: string }>();
  const [acceptedToken, setAcceptedToken] = useState<string>();
  const inv = isDemoMode() ? readDemoInvitation(token) : null;
  return (
    <main className="min-h-screen grid place-items-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("demo_team_invite_title")}</CardTitle>
          <CardDescription>{t("demo_team_invite_notice")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!inv ? <p>{t("invitation_not_found_or_expired")}</p> : inv.status === "accepted" || acceptedToken === token ?
            <p role="status">{t("demo_team_joined", { site: inv.siteName })}</p> : <>
              <p>{inv.siteName} · {t("role_" + inv.role)}</p>
              <p>{inv.identifier}</p>
              <Button onClick={() => { if (acceptDemoInvitation(token)) setAcceptedToken(token); }}>{t("demo_team_join")}</Button>
            </>}
        </CardContent>
      </Card>
    </main>
  );
}
