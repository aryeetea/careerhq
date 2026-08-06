import * as React from "react";
import { createPortal } from "react-dom";
import { useViewportSize } from "@/hooks/useViewportSize";
import { useIsCompact } from "@/hooks/useTheme";
import { useTourTargetRect } from "@/hooks/useTourTargetRect";
import { computeCardPosition, connectorPoints } from "@/lib/tour/position";
import { endAngle } from "@/lib/tour/path";
import { Spotlight } from "@/components/tour/Spotlight";
import { GuideLine } from "@/components/tour/GuideLine";
import { GuideArrow } from "@/components/tour/GuideArrow";
import { TourCard } from "@/components/tour/TourCard";
import type { Tour } from "@/lib/tour/types";

export function TourOverlay({
  tour,
  stepIndex,
  onNext,
  onBack,
  onSkip,
  onClose,
}: {
  tour: Tour;
  stepIndex: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const step = tour.steps[stepIndex];
  const viewport = useViewportSize();
  const isCompact = useIsCompact();
  const anchorRect = useTourTargetRect(step.target, true);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = React.useState({ width: 300, height: 150 });

  // Re-measure the card's real rendered size synchronously before paint, so
  // any correction (heights vary a little step to step) lands before the
  // browser ever shows the previous position — no visible jump.
  React.useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => setCardSize({ width: el.offsetWidth, height: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step.id, isCompact]);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        onNext();
      } else if (e.key === "ArrowLeft") {
        onBack();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNext, onBack]);

  // Bookend steps (welcome, finale) never have a target. A step that does
  // have one but can't currently find it on screen (e.g. a nav item tucked
  // behind a closed "More" menu on a small viewport) falls back to the same
  // centered position gracefully, rather than getting stuck.
  const isBookend = !step.target;
  const showSpotlight = Boolean(anchorRect) && !isBookend;
  const showConnector = showSpotlight && !isCompact;

  const position = isCompact
    ? null
    : computeCardPosition(showSpotlight ? anchorRect : null, cardSize, viewport, step.placement);

  const connector = showConnector && anchorRect && position ? connectorPoints(anchorRect, position, cardSize) : null;
  const angle = connector ? endAngle(connector.from, connector.to, step.id) : 0;

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 80 }}>
      {/* Swallows clicks everywhere behind the tour so nothing is triggered
          by accident — but never closes the tour itself; only Skip, Finish,
          or Esc do that. */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      {showSpotlight && anchorRect && <Spotlight rect={anchorRect} viewport={viewport} padding={step.spotlightPadding} />}

      {connector && (
        <svg className="pointer-events-none fixed inset-0" style={{ zIndex: 90 }} width={viewport.width} height={viewport.height} aria-hidden="true">
          <GuideLine from={connector.from} to={connector.to} seed={step.id} />
          <GuideArrow point={connector.to} angleDeg={angle} />
        </svg>
      )}

      <TourCard
        key={step.id}
        ref={cardRef}
        step={step}
        stepIndex={stepIndex}
        totalSteps={tour.steps.length}
        isFirst={stepIndex === 0}
        isLast={stepIndex === tour.steps.length - 1}
        centered={isBookend}
        sheet={isCompact}
        style={position ? { top: position.top, left: position.left } : undefined}
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
      />
    </div>,
    document.body
  );
}
