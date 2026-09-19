"use client";

import { Slot } from "radix-ui";
import type { HTMLAttributes, ReactElement } from "react";
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
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
  indicators: StepIndicators;
  orientation: StepperOrientation;
  registerTrigger: (node: HTMLButtonElement) => void;
  setActiveStep: (step: number) => void;
  stepsCount: number;
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

  const registerTrigger = useCallback((node: HTMLButtonElement) => {
    setTriggerNodes((prev) => {
      if (!prev.includes(node)) {
        return [...prev, node];
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

  // Keyboard navigation logic
  const focusTrigger = useCallback(
    (idx: number) => {
      if (triggerNodes[idx]) {
        triggerNodes[idx].focus();
      }
    },
    [triggerNodes]
  );
  const focusNext = useCallback(
    (currentIdx: number) => {
      if (triggerNodes.length) {
        focusTrigger((currentIdx + 1) % triggerNodes.length);
      }
    },
    [focusTrigger, triggerNodes.length]
  );
  const focusPrev = useCallback(
    (currentIdx: number) => {
      if (triggerNodes.length) {
        focusTrigger(
          (currentIdx - 1 + triggerNodes.length) % triggerNodes.length
        );
      }
    },
    [focusTrigger, triggerNodes.length]
  );
  const focusFirst = useCallback(() => focusTrigger(0), [focusTrigger]);
  const focusLast = useCallback(
    () => focusTrigger(triggerNodes.length - 1),
    [focusTrigger, triggerNodes.length]
  );

  // Context value
  const contextValue = useMemo<StepperContextValue>(
    () => ({
      activeStep: currentStep,
      setActiveStep: handleSetActiveStep,
      stepsCount: Children.toArray(children).filter(
        (child): child is ReactElement =>
          isValidElement(child) &&
          (child.type as { displayName?: string }).displayName === "StepperItem"
      ).length,
      orientation,
      registerTrigger,
      focusNext,
      focusPrev,
      focusFirst,
      focusLast,
      triggerNodes,
      indicators,
      unregisterTrigger,
    }),
    [
      currentStep,
      handleSetActiveStep,
      children,
      orientation,
      registerTrigger,
      triggerNodes,
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

function StepperTrigger({
  asChild = false,
  className,
  children,
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
  } = stepperCtx;
  const { step, isDisabled } = useStepItem();
  const isSelected = activeStep === step;
  const id = `stepper-tab-${step}`;
  const panelId = `stepper-panel-${step}`;

  // Register this trigger for keyboard navigation
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const node = btnRef.current;
    if (node) {
      registerTrigger(node);
      return () => unregisterTrigger(node);
    }
    return;
  }, [registerTrigger, unregisterTrigger]);

  // Find our index among triggers for navigation
  const myIdx = useMemo(
    () =>
      triggerNodes.findIndex((n: HTMLButtonElement) => n === btnRef.current),
    [triggerNodes]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        if (myIdx !== -1 && focusNext) {
          focusNext(myIdx);
        }
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        if (myIdx !== -1 && focusPrev) {
          focusPrev(myIdx);
        }
        break;
      case "Home":
        e.preventDefault();
        if (focusFirst) {
          focusFirst();
        }
        break;
      case "End":
        e.preventDefault();
        if (focusLast) {
          focusLast();
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        setActiveStep(step);
        break;
      default:
        break;
    }
  };

  // `asChild` composes onto the consumer's element via Slot, so the trigger
  // keeps its ref, tab semantics, and keyboard handlers either way.
  const Comp = asChild ? Slot.Root : "button";
  let resolvedTabIndex = -1;
  if (typeof tabIndex === "number") {
    resolvedTabIndex = tabIndex;
  } else if (isSelected) {
    resolvedTabIndex = 0;
  }

  return (
    <Comp
      aria-controls={panelId}
      aria-selected={isSelected}
      className={cn(
        "inline-flex cursor-pointer items-center outline-none focus-visible:z-10 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60",
        "gap-2.5 rounded-full",
        className
      )}
      data-loading={isLoading}
      data-slot="stepper-trigger"
      data-state={state}
      disabled={isDisabled}
      id={id}
      onClick={() => setActiveStep(step)}
      onKeyDown={handleKeyDown}
      ref={btnRef}
      role="tab"
      tabIndex={resolvedTabIndex}
      {...props}
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
        "m-0.5 rounded-full bg-muted group-data-[orientation=horizontal]/stepper-nav:h-0.5 group-data-[orientation=vertical]/stepper-nav:h-12 group-data-[orientation=vertical]/stepper-nav:w-0.5 group-data-[orientation=horizontal]/stepper-nav:flex-1",
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
}: StepperContentProps) {
  const { activeStep } = useStepper();
  const isActive = value === activeStep;

  if (!(forceMount || isActive)) {
    return null;
  }

  return (
    <div
      className={cn("w-full", className, !isActive && forceMount && "hidden")}
      data-slot="stepper-content"
      data-state={activeStep}
      hidden={!isActive && forceMount}
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
