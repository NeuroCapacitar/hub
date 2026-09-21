"use client";

import { Slot } from "radix-ui";
import type { HTMLAttributes } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

// Types
type StepperOrientation = "horizontal" | "vertical";
type StepState = "active" | "completed" | "inactive" | "loading";
interface StepIndicators {
  active?: React.ReactNode;
  completed?: React.ReactNode;
  inactive?: React.ReactNode;
  loading?: React.ReactNode;
}

interface StepperContextValue {
  activeStep: number;
  focusFirst: () => void;
  focusLast: () => void;
  focusNext: (currentIdx: number) => void;
  focusPrev: (currentIdx: number) => void;
  idPrefix: string;
  indicators: StepIndicators;
  orientation: StepperOrientation;
  registerTrigger: (node: HTMLButtonElement) => void;
  setActiveStep: (step: number) => void;
  triggerNodes: HTMLButtonElement[];
  unregisterTrigger: (node: HTMLButtonElement) => void;
}

interface StepItemContextValue {
  isDisabled: boolean;
  isLoading: boolean;
  state: StepState;
  step: number;
}

const StepperContext = createContext<StepperContextValue | undefined>(
  undefined
);
const StepItemContext = createContext<StepItemContextValue | undefined>(
  undefined
);

function compareTriggerNodes(
  first: HTMLButtonElement,
  second: HTMLButtonElement
): number {
  const position = first.compareDocumentPosition(second);
  // compareDocumentPosition returns a bitmask, so a bitwise check is intentional here.
  // biome-ignore lint/suspicious/noBitwiseOperators: DOM position flags are bitmasks.
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1;
  }
  // biome-ignore lint/suspicious/noBitwiseOperators: DOM position flags are bitmasks.
  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1;
  }
  return 0;
}

function sortTriggerNodes(nodes: HTMLButtonElement[]): HTMLButtonElement[] {
  return [...nodes].sort(compareTriggerNodes);
}

function useStepper() {
  const ctx = useContext(StepperContext);
  if (!ctx) {
    throw new Error("useStepper must be used within a Stepper");
  }
  return ctx;
}

function useStepItem() {
  const ctx = useContext(StepItemContext);
  if (!ctx) {
    throw new Error("useStepItem must be used within a StepperItem");
  }
  return ctx;
}

interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: number;
  indicators?: StepIndicators;
  onValueChange?: (value: number) => void;
  orientation?: StepperOrientation;
  value?: number;
}

function Stepper({
  defaultValue = 1,
  value,
  onValueChange,
  orientation = "horizontal",
  className,
  children,
  indicators = {},
  ...props
}: StepperProps) {
  const [activeStep, setActiveStep] = useState(defaultValue);
  const [triggerNodes, setTriggerNodes] = useState<HTMLButtonElement[]>([]);
  const idPrefix = useId();

  const registerTrigger = useCallback((node: HTMLButtonElement) => {
    setTriggerNodes((prev) => {
      if (!prev.includes(node)) {
        return sortTriggerNodes([...prev, node]);
      }
      return prev;
    });
  }, []);
  const unregisterTrigger = useCallback((node: HTMLButtonElement) => {
    setTriggerNodes((prev) => prev.filter((current) => current !== node));
  }, []);

  const handleSetActiveStep = useCallback(
    (step: number) => {
      if (value === undefined) {
        setActiveStep(step);
      }
      onValueChange?.(step);
    },
    [value, onValueChange]
  );

  const currentStep = value ?? activeStep;
  const orderedTriggerNodes = sortTriggerNodes(triggerNodes);

  // Keyboard navigation logic
  const focusTrigger = useCallback(
    (idx: number) => {
      if (orderedTriggerNodes[idx]) {
        orderedTriggerNodes[idx].focus();
      }
    },
    [orderedTriggerNodes]
  );
  const focusNext = useCallback(
    (currentIdx: number) => {
      if (orderedTriggerNodes.length) {
        focusTrigger((currentIdx + 1) % orderedTriggerNodes.length);
      }
    },
    [focusTrigger, orderedTriggerNodes.length]
  );
  const focusPrev = useCallback(
    (currentIdx: number) => {
      if (orderedTriggerNodes.length) {
        focusTrigger(
          (currentIdx - 1 + orderedTriggerNodes.length) %
            orderedTriggerNodes.length
        );
      }
    },
    [focusTrigger, orderedTriggerNodes.length]
  );
  const focusFirst = useCallback(() => focusTrigger(0), [focusTrigger]);
  const focusLast = useCallback(
    () => focusTrigger(orderedTriggerNodes.length - 1),
    [focusTrigger, orderedTriggerNodes.length]
  );

  // Context value
  const contextValue = useMemo<StepperContextValue>(
    () => ({
      activeStep: currentStep,
      setActiveStep: handleSetActiveStep,
      idPrefix,
      orientation,
      registerTrigger,
      focusNext,
      focusPrev,
      focusFirst,
      focusLast,
      triggerNodes: orderedTriggerNodes,
      indicators,
      unregisterTrigger,
    }),
    [
      currentStep,
      handleSetActiveStep,
      idPrefix,
      orientation,
      registerTrigger,
      orderedTriggerNodes,
      focusNext,
      focusPrev,
      focusFirst,
      focusLast,
      indicators,
      unregisterTrigger,
    ]
  );

  return (
    <StepperContext.Provider value={contextValue}>
      <div
        aria-orientation={orientation}
        className={cn("w-full", className)}
        data-orientation={orientation}
        data-slot="stepper"
        role="tablist"
        {...props}
      >
        {children}
      </div>
    </StepperContext.Provider>
  );
}

interface StepperItemProps extends React.HTMLAttributes<HTMLDivElement> {
  completed?: boolean;
  disabled?: boolean;
  loading?: boolean;
  step: number;
}

function StepperItem({
  step,
  completed = false,
  disabled = false,
  loading = false,
  className,
  children,
  ...props
}: StepperItemProps) {
  const { activeStep } = useStepper();

  let state: StepState = "inactive";
  if (completed || step < activeStep) {
    state = "completed";
  } else if (activeStep === step) {
    state = "active";
  }

  const isLoading = loading && step === activeStep;

  return (
    <StepItemContext.Provider
      value={{ step, state, isDisabled: disabled, isLoading }}
    >
      <div
        className={cn(
          "group/step flex not-last:flex-1 items-center justify-center group-data-[orientation=horizontal]/stepper-nav:flex-row group-data-[orientation=vertical]/stepper-nav:flex-col",
          className
        )}
        data-slot="stepper-item"
        data-state={state}
        {...(isLoading ? { "data-loading": true } : {})}
        {...props}
      >
        {children}
      </div>
    </StepItemContext.Provider>
  );
}

interface StepperTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function handleStepperNavigationKeyDown({
  event,
  focusFirst,
  focusLast,
  focusNext,
  focusPrev,
  myIdx,
  orientation,
}: {
  event: React.KeyboardEvent<HTMLButtonElement>;
  focusFirst: () => void;
  focusLast: () => void;
  focusNext: (index: number) => void;
  focusPrev: (index: number) => void;
  myIdx: number;
  orientation: StepperOrientation;
}): void {
  const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
  const prevKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";

  if (event.key === "Home") {
    event.preventDefault();
    focusFirst();
    return;
  }
  if (event.key === "End") {
    event.preventDefault();
    focusLast();
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.currentTarget.click();
    return;
  }
  if (myIdx === -1 || (event.key !== nextKey && event.key !== prevKey)) {
    return;
  }
  event.preventDefault();
  if (event.key === nextKey) {
    focusNext(myIdx);
  } else {
    focusPrev(myIdx);
  }
}

function StepperTrigger({
  asChild = false,
  className,
  children,
  disabled: triggerDisabled,
  onClick: onClickProp,
  onKeyDown: onKeyDownProp,
  tabIndex,
  ...props
}: StepperTriggerProps) {
  const { state, isLoading } = useStepItem();
  const stepperCtx = useStepper();
  const {
    setActiveStep,
    activeStep,
    registerTrigger,
    unregisterTrigger,
    triggerNodes,
    focusNext,
    focusPrev,
    focusFirst,
    focusLast,
    idPrefix,
    orientation,
  } = stepperCtx;
  const { step, isDisabled } = useStepItem();
  const isSelected = activeStep === step;
  const isTriggerDisabled = isDisabled || Boolean(triggerDisabled);
  const id = `${idPrefix}-tab-${step}`;
  const panelId = `${idPrefix}-panel-${step}`;

  // Register this trigger for keyboard navigation
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const node = btnRef.current;
    if (node && !isTriggerDisabled) {
      registerTrigger(node);
      return () => unregisterTrigger(node);
    }
    return;
  }, [isTriggerDisabled, registerTrigger, unregisterTrigger]);

  // Find our index among triggers for navigation
  const myIdx = useMemo(
    () =>
      triggerNodes.findIndex((n: HTMLButtonElement) => n === btnRef.current),
    [triggerNodes]
  );
  const hasEnabledActiveTrigger = triggerNodes.some(
    (node) => node.id === `${idPrefix}-tab-${activeStep}`
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (isTriggerDisabled) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
      }
      return;
    }
    onKeyDownProp?.(e);
    if (e.defaultPrevented) {
      return;
    }
    handleStepperNavigationKeyDown({
      event: e,
      focusFirst,
      focusLast,
      focusNext,
      focusPrev,
      myIdx,
      orientation,
    });
  };

  // `asChild` composes onto the consumer's element via Slot, so the trigger
  // keeps its ref, tab semantics, and keyboard handlers either way.
  const Comp = asChild ? Slot.Root : "button";
  let resolvedTabIndex = -1;
  if (!isTriggerDisabled) {
    if (typeof tabIndex === "number") {
      resolvedTabIndex = tabIndex;
    } else if (
      isSelected ||
      (!hasEnabledActiveTrigger && triggerNodes[0] === btnRef.current)
    ) {
      resolvedTabIndex = 0;
    }
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if (isTriggerDisabled) {
      event.preventDefault();
      return;
    }
    onClickProp?.(event);
    if (!event.defaultPrevented) {
      setActiveStep(step);
    }
  };

  return (
    <Comp
      {...props}
      aria-controls={panelId}
      aria-disabled={isTriggerDisabled || undefined}
      aria-selected={isSelected}
      className={cn(
        "inline-flex cursor-pointer items-center outline-none focus-visible:z-10 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60",
        "gap-2.5 rounded-full",
        className
      )}
      data-loading={isLoading}
      data-slot="stepper-trigger"
      data-state={state}
      disabled={isTriggerDisabled}
      id={id}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      ref={btnRef}
      role="tab"
      tabIndex={resolvedTabIndex}
    >
      {children}
    </Comp>
  );
}

function StepperIndicator({
  children,
  className,
}: React.ComponentProps<"div">) {
  const { state, isLoading } = useStepItem();
  const { indicators } = useStepper();

  return (
    <div
      className={cn(
        "relative flex size-6 shrink-0 items-center justify-center overflow-hidden border-background bg-accent text-accent-foreground data-[state=active]:bg-primary data-[state=completed]:bg-primary data-[state=active]:text-primary-foreground data-[state=completed]:text-primary-foreground",
        "rounded-full text-xs",
        className
      )}
      data-slot="stepper-indicator"
      data-state={state}
    >
      <div className="absolute">
        {indicators &&
        ((isLoading && indicators.loading) ||
          (state === "completed" && indicators.completed) ||
          (state === "active" && indicators.active) ||
          (state === "inactive" && indicators.inactive))
          ? (isLoading && indicators.loading) ||
            (state === "completed" && indicators.completed) ||
            (state === "active" && indicators.active) ||
            (state === "inactive" && indicators.inactive)
          : children}
      </div>
    </div>
  );
}

function StepperSeparator({ className }: React.ComponentProps<"div">) {
  const { state } = useStepItem();

  return (
    <div
      className={cn(
        "m-0.5 rounded-full bg-muted group-data-[orientation=horizontal]/stepper-nav:h-0.5 group-data-[orientation=vertical]/stepper-nav:h-12 group-data-[orientation=vertical]/stepper-nav:w-0.5 group-data-[orientation=horizontal]/stepper-nav:flex-1 group-data-[state=active]/step:bg-primary/40 group-data-[state=completed]/step:bg-primary",
        className
      )}
      data-slot="stepper-separator"
      data-state={state}
    />
  );
}

function StepperTitle({ children, className }: React.ComponentProps<"h3">) {
  const { state } = useStepItem();

  return (
    <h3
      className={cn("font-medium text-sm leading-none", className)}
      data-slot="stepper-title"
      data-state={state}
    >
      {children}
    </h3>
  );
}

function StepperDescription({
  children,
  className,
}: React.ComponentProps<"div">) {
  const { state } = useStepItem();

  return (
    <div
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="stepper-description"
      data-state={state}
    >
      {children}
    </div>
  );
}

function StepperNav({ children, className }: React.ComponentProps<"nav">) {
  const { activeStep, orientation } = useStepper();

  return (
    <nav
      className={cn(
        "group/stepper-nav inline-flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col",
        className
      )}
      data-orientation={orientation}
      data-slot="stepper-nav"
      data-state={activeStep}
    >
      {children}
    </nav>
  );
}

function StepperPanel({ children, className }: React.ComponentProps<"div">) {
  const { activeStep } = useStepper();

  return (
    <div
      className={cn("w-full", className)}
      data-slot="stepper-panel"
      data-state={activeStep}
    >
      {children}
    </div>
  );
}

interface StepperContentProps extends React.ComponentProps<"div"> {
  forceMount?: boolean;
  value: number;
}

function StepperContent({
  value,
  forceMount,
  children,
  className,
  ...props
}: StepperContentProps) {
  const { activeStep, idPrefix } = useStepper();
  const isActive = value === activeStep;

  if (!(forceMount || isActive)) {
    return null;
  }

  return (
    <div
      {...props}
      aria-labelledby={`${idPrefix}-tab-${value}`}
      className={cn("w-full", className, !isActive && forceMount && "hidden")}
      data-slot="stepper-content"
      data-state={activeStep}
      hidden={!isActive && forceMount}
      id={`${idPrefix}-panel-${value}`}
      role="tabpanel"
    >
      {children}
    </div>
  );
}

export {
  Stepper,
  StepperContent,
  type StepperContentProps,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  type StepperItemProps,
  StepperNav,
  StepperPanel,
  type StepperProps,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
  type StepperTriggerProps,
  useStepItem,
  useStepper,
};
