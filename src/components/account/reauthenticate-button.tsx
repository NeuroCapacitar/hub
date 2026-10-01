"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function ReauthenticateButton({
  label = "Sair e entrar novamente",
}: {
  label?: string;
}): React.JSX.Element {
  const [isPending, setIsPending] = useState(false);

  const signOut = async (): Promise<void> => {
    setIsPending(true);
    try {
      await authClient.signOut();
    } finally {
      window.location.assign("/entrar");
    }
  };

  return (
    <Button
      loading={isPending}
      onClick={signOut}
      type="button"
      variant="outline"
    >
      {label}
    </Button>
  );
}
