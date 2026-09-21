"use client";

import { HistoryIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function CertificateHistorySheet({
  certificateCount,
  children,
}: {
  certificateCount: number;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={HistoryIcon}
          />
          Histórico ({certificateCount})
        </Button>
      </SheetTrigger>
      <SheetContent
        className="w-full gap-0 p-0 data-[side=right]:sm:max-w-[720px]"
        side="right"
      >
        <SheetHeader className="border-b pr-14">
          <SheetTitle>Histórico de certificados</SheetTitle>
          <SheetDescription>
            Registros que não estão mais válidos, mantidos aqui para consulta.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 p-5 sm:p-6">
          {children}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
