"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const GoogleMark = (): React.JSX.Element => (
  <svg
    aria-hidden="true"
    className="size-[1.125rem]"
    focusable="false"
    viewBox="0 0 48 48"
  >
    <path
      d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z"
      fill="#4285F4"
    />
    <path
      d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.3A20 20 0 0 0 24 44Z"
      fill="#34A853"
    />
    <path
      d="M12.8 27.8a12 12 0 0 1 0-7.6v-5.3H5.9a20 20 0 0 0 0 18.2l6.9-5.3Z"
      fill="#FBBC05"
    />
    <path
      d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9A19.7 19.7 0 0 0 24 4 20 20 0 0 0 5.9 14.9l6.9 5.3C14.4 15.5 18.8 12 24 12Z"
      fill="#EA4335"
    />
  </svg>
);

export function GoogleAuthButton({
  callbackUrl,
  label,
  requestSignUp = false,
}: {
  callbackUrl: string;
  label: string;
  requestSignUp?: boolean;
}): React.JSX.Element {
  const [error, setError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleClick = async (): Promise<void> => {
    setError(false);
    setIsPending(true);

    try {
      const result = await authClient.signIn.social({
        callbackURL: callbackUrl,
        errorCallbackURL: callbackUrl,
        newUserCallbackURL: callbackUrl,
        provider: "google",
        ...(requestSignUp ? { requestSignUp: true } : {}),
      });

      if (result.error) {
        setError(true);
        setIsPending(false);
      }
    } catch {
      setError(true);
      setIsPending(false);
    }
  };

  return (
    <div className="mb-5">
      <Button
        className="h-12 w-full gap-3"
        loading={isPending}
        onClick={handleClick}
        type="button"
        variant="outline"
      >
        <GoogleMark />
        {label}
      </Button>
      {error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>
            Não foi possível iniciar a entrada com Google. Tente novamente ou
            use seu e-mail.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="my-5 flex items-center gap-3 text-muted-foreground text-xs">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span>ou continue com e-mail</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
