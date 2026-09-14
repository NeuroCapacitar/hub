"use client";

import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>): React.JSX.Element {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        className={cn("pr-11", className)}
        type={isVisible ? "text" : "password"}
      />
      <Button
        aria-label={isVisible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={isVisible}
        className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
        onClick={() => setIsVisible((current) => !current)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={isVisible ? ViewOffIcon : ViewIcon}
          size={16}
          strokeWidth={2}
        />
      </Button>
    </div>
  );
}
