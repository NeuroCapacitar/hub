import { AccountEmailPanel } from "@/components/account/account-email-panel";
import { AccountSecurityPanel } from "@/components/account/account-security-panel";
import { AccountProfilePanel } from "@/components/account/profile-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccountSecuritySummary } from "@/features/account/profile";
import { isGoogleOAuthProviderConfigured } from "@/lib/auth-policy";
import { getServerEnv } from "@/lib/env";
import type { AppSession } from "@/lib/session";

export function AccountProfileSection({
  security,
  session,
  settingsHref,
}: {
  security: AccountSecuritySummary;
  session: AppSession;
  settingsHref: string;
}): React.JSX.Element {
  const environment = getServerEnv();
  const googleOAuthEnabled = isGoogleOAuthProviderConfigured({
    clientId: environment.GOOGLE_CLIENT_ID,
    clientSecret: environment.GOOGLE_CLIENT_SECRET,
  });

  return (
    <section
      aria-labelledby="account-profile-title"
      className="grid scroll-mt-24 gap-12"
      id="minha-conta"
    >
      <div className="grid gap-6">
        <div className="space-y-1">
          <h2 className="type-section-title" id="account-profile-title">
            Minha conta
          </h2>
          <p className="text-muted-foreground text-sm">
            Gerencie suas informações pessoais e métodos de entrada.
          </p>
        </div>
        <Card size="sm">
          <CardHeader>
            <CardTitle as="h3">Informações pessoais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-8">
            <AccountProfilePanel
              avatarMode={security.avatarMode}
              image={session.user.image}
              key={session.user.name}
              name={session.user.name}
            />
            <AccountEmailPanel
              currentEmail={session.user.email}
              emailVerified={session.emailVerified}
              pendingEmailChange={security.pendingEmailChange}
            />
          </CardContent>
        </Card>
      </div>
      <section
        aria-labelledby="account-entry-methods-title"
        className="grid scroll-mt-24 gap-6"
        id="acesso-conta"
      >
        <div className="space-y-1">
          <h3 className="type-section-title" id="account-entry-methods-title">
            Métodos de entrada
          </h3>
          <p className="text-muted-foreground text-sm">
            Conecte sua conta Google para entrar com facilidade.
          </p>
        </div>
        <AccountSecurityPanel
          accountSettingsPath={settingsHref}
          emailVerified={session.emailVerified}
          googleOAuthEnabled={googleOAuthEnabled}
          hasGoogleAccount={security.hasGoogleAccount}
        />
      </section>
    </section>
  );
}
