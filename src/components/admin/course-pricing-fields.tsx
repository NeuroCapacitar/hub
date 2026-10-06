"use client";

import type React from "react";
import { FieldError, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  type CoursePricingMode,
  parseCoursePriceToCents,
} from "@/features/payments/course-price";
import { formatCurrencyInCents } from "@/lib/formatters";

export function CoursePricingModeField({
  error,
  idPrefix,
  onValueChange,
  value,
}: {
  error?: string | undefined;
  idPrefix: string;
  onValueChange: (value: CoursePricingMode) => void;
  value: CoursePricingMode | "";
}): React.JSX.Element {
  const legendId = `${idPrefix}-legend`;
  const errorId = `${idPrefix}-error`;
  const freeId = `${idPrefix}-free`;
  const paidId = `${idPrefix}-paid`;

  return (
    <FieldSet className="gap-3">
      <FieldLegend id={legendId}>Preço do curso</FieldLegend>
      <RadioGroup
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        aria-labelledby={legendId}
        aria-required="true"
        className="gap-3"
        onValueChange={(nextValue) => {
          if (nextValue === "free" || nextValue === "paid") {
            onValueChange(nextValue);
          }
        }}
        value={value}
      >
        <label className="flex items-start gap-3 text-sm" htmlFor={freeId}>
          <RadioGroupItem className="mt-0.5" id={freeId} value="free" />
          <span className="grid gap-1">
            <span className="font-medium">Gratuito</span>
            <span className="text-muted-foreground">
              Sem cobrança; a inscrição é feita pelo Hub quando o Curso está
              disponível.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm" htmlFor={paidId}>
          <RadioGroupItem className="mt-0.5" id={paidId} value="paid" />
          <span className="grid gap-1">
            <span className="font-medium">Pago</span>
            <span className="text-muted-foreground">
              O aluno paga para acessar o Curso.
            </span>
          </span>
        </label>
      </RadioGroup>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </FieldSet>
  );
}

export function CoursePriceInput({
  ariaDescribedBy,
  ariaInvalid,
  id,
  onValueChange,
  value,
}: {
  ariaDescribedBy: string;
  ariaInvalid: boolean;
  id: string;
  onValueChange: (value: string) => void;
  value: string;
}): React.JSX.Element {
  return (
    <Input
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid ? true : undefined}
      autoComplete="off"
      id={id}
      inputMode="decimal"
      name="price"
      onBlur={(event) => {
        try {
          const priceInCents = parseCoursePriceToCents(
            event.currentTarget.value
          );
          onValueChange(formatCurrencyInCents(priceInCents));
        } catch {
          // Keep invalid text visible so the person can correct it.
        }
      }}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      placeholder="R$ 497,00"
      required
      value={value}
    />
  );
}
