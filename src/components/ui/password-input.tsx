"use client";

import { EyeClosedIcon, EyeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({
  className,
  disabled,
  id,
  ...props
}: React.ComponentProps<typeof Input>): React.JSX.Element {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        className={cn("pe-11", className)}
        disabled={disabled}
        id={id}
        type={isVisible ? "text" : "password"}
      />
      <button
        aria-controls={id}
        aria-label={
          isVisible
            ? "Ocultar conteúdo confidencial"
            : "Mostrar conteúdo confidencial"
        }
        aria-pressed={isVisible}
        className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-lg text-muted-foreground outline-none transition-[background-color,color,scale] hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 active:scale-[0.96]"
        disabled={disabled}
        onClick={() => setIsVisible((visible) => !visible)}
        onPointerDown={(event) => event.preventDefault()}
        title={isVisible ? "Ocultar senha" : "Mostrar senha"}
        type="button"
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={isVisible ? EyeClosedIcon : EyeIcon}
          size={18}
          strokeWidth={2}
        />
      </button>
    </div>
  );
}
