import type { ComponentProps, CSSProperties } from "react";
import { cn } from "@/lib/utils";
import iconCircleCheckAsset from "./IconCircleCheck.svg";

const iconCircleCheckSource =
  typeof iconCircleCheckAsset === "string"
    ? iconCircleCheckAsset
    : iconCircleCheckAsset.src;
const iconCircleCheckMask = `url("${iconCircleCheckSource}")`;

const iconCircleCheckStyle: CSSProperties = {
  maskImage: iconCircleCheckMask,
  maskPosition: "center",
  maskRepeat: "no-repeat",
  maskSize: "contain",
  WebkitMaskImage: iconCircleCheckMask,
  WebkitMaskPosition: "center",
  WebkitMaskRepeat: "no-repeat",
  WebkitMaskSize: "contain",
};

export function IconCircleCheck({
  className,
  style,
  ...props
}: ComponentProps<"span">): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-4 shrink-0 bg-current", className)}
      data-slot="icon-circle-check"
      style={{ ...iconCircleCheckStyle, ...style }}
      {...props}
    />
  );
}
