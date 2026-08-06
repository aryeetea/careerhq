import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TourProgress } from "@/components/tour/TourProgress";
import { cn } from "@/lib/utils";
import type { TourStep } from "@/lib/tour/types";

export interface TourCardProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  /** Content layout: bigger icon, no inline back/skip, one full-width
   * button. Used for the target-less welcome and finale steps. */
  centered: boolean;
  /** Positioning: an edge-to-edge bottom sheet instead of a floated card
   * near the target — used on phone-width viewports, where a floating card
   * plus a diagonal connector line has nowhere good to sit. */
  sheet?: boolean;
  style?: React.CSSProperties;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

/**
 * The tour's "conversation card" — small, rounded, floating, glassy. Owns
 * nothing about positioning (its parent, TourOverlay, measures it and
 * passes `style`); it just renders content and a light focus trap so Tab
 * cycles its own buttons instead of wandering into the page behind it.
 */
export const TourCard = React.forwardRef<HTMLDivElement, TourCardProps>(function TourCard(
  { step, stepIndex, totalSteps, isFirst, isLast, centered, sheet, style, onNext, onBack, onSkip },
  ref
) {
  const localRef = React.useRef<HTMLDivElement>(null);
  const nextRef = React.useRef<HTMLButtonElement>(null);
  const Icon = step.icon;

  React.useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

  React.useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [step.id]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const focusables = localRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)");
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={localRef}
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      onKeyDown={onKeyDown}
      style={sheet ? undefined : style}
      className={cn(
        "glass-strong fixed z-[95] animate-scale-in rounded-3xl p-5 shadow-lift",
        sheet
          ? "inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))]"
          : cn("w-[300px]", centered && "w-[320px]"),
        centered && "text-center"
      )}
    >
      <div className={cn("flex items-center gap-2.5", centered && "flex-col")}>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary", centered && "h-12 w-12")}>
          <Icon className={cn("h-4.5 w-4.5", centered && "h-6 w-6")} />
        </span>
        <div aria-live="polite" className={cn(centered && "mt-1")}>
          <h2 className="font-display text-lg font-semibold leading-tight">{step.title}</h2>
        </div>
      </div>

      <p className={cn("mt-2.5 text-[13.5px] leading-6 text-foreground/75", centered && "text-sm")}>{step.body}</p>

      <div className={cn("mt-4 flex items-center gap-2", centered ? "justify-center" : "justify-between")}>
        {!centered && (
          <>
            <div className="flex items-center gap-1">
              {!isFirst && (
                <Button type="button" variant="ghost" size="sm" onClick={onBack} className="h-7 gap-0.5 px-2 text-xs text-muted-foreground">
                  <ChevronLeft className="h-3.5 w-3.5" /> Back
                </Button>
              )}
            </div>
            <TourProgress total={totalSteps} current={stepIndex} />
            <Button type="button" ref={nextRef} size="sm" onClick={onNext} className="h-7 px-3 text-xs">
              {isLast ? "Finish" : "Next"}
            </Button>
          </>
        )}
        {centered && (
          <Button type="button" ref={nextRef} size="lg" onClick={onNext} className="w-full">
            {isLast ? "Start exploring" : "Let's go"}
          </Button>
        )}
      </div>

      {!centered && !isLast && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-3 block w-full text-center text-[11px] font-medium text-muted-foreground/70 transition-colors hover:text-muted-foreground"
        >
          Skip tour
        </button>
      )}
    </div>
  );
});
