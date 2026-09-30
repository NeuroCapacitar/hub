"use client";

import { useState } from "react";
import { GoogleMark } from "@/components/google-auth-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

function GoogleAccountControl({
  accountSettingsPath,
  emailVerified,
  googleOAuthEnabled,
  linked,
}: {
  accountSettingsPath: string;
  emailVerified: boolean;
  googleOAuthEnabled: boolean;
  linked: boolean;
}): React.JSX.Element {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canConnect = googleOAuthEnabled && emailVerified;

  const linkGoogle = async (): Promise<void> => {
    if (!canConnect) {
      return;
    }
    setError(null);
    setIsPending(true);
    try {
      const callbackURL = new URL(
        accountSettingsPath,
        window.location.origin
      ).toString();
      const result = await authClient.linkSocial({
        callbackURL,
        provider: "google",
      });
      if (result.error) {
        setError("Não foi possível conectar ao Google. Tente novamente.");
        setIsPending(false);
      }
    } catch {
      setError("Não foi possível conectar ao Google. Tente novamente.");
      setIsPending(false);
    }
  };

  return (
    <Card size="sm">
      <CardContent className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center">
            <GoogleMark />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">Google</p>
              {linked ? <Badge variant="success">Conectado</Badge> : null}
            </div>
            {googleOAuthEnabled && emailVerified ? null : (
              <p
                className="text-muted-foreground text-sm"
                id="google-link-unavailable"
              >
                {googleOAuthEnabled
                  ? "Confirme seu e-mail para conectar."
                  : "Google indisponível no momento."}
              </p>
            )}
          </div>
        </div>
        {linked ? null : (
          <Button
            aria-describedby={
              canConnect ? undefined : "google-link-unavailable"
            }
            disabled={!canConnect}
            loading={isPending}
            onClick={linkGoogle}
            type="button"
            variant="outline"
          >
            Conectar Google
          </Button>
        )}
        {error ? (
          <p
            aria-live="polite"
            className="text-destructive text-sm"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AccountSecurityPanel({
  accountSettingsPath,
  emailVerified,
  googleOAuthEnabled,
  hasGoogleAccount,
}: {
  accountSettingsPath: string;
  emailVerified: boolean;
  googleOAuthEnabled: boolean;
  hasGoogleAccount: boolean;
}): React.JSX.Element {
  return (
    <GoogleAccountControl
      accountSettingsPath={accountSettingsPath}
      emailVerified={emailVerified}
      googleOAuthEnabled={googleOAuthEnabled}
      linked={hasGoogleAccount}
    />
  );
}
