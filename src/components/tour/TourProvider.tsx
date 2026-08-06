import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useProfile, useCompleteTour } from "@/hooks/queries/useProfile";
import { useCelebration } from "@/components/ambient/Celebration";
import { onboardingTour } from "@/lib/tour/onboardingTour";
import { TourOverlay } from "@/components/tour/TourOverlay";
import type { Tour } from "@/lib/tour/types";

interface StartOptions {
  /** True only for the automatic, first-time-ever run — marks
   * profiles.tour_completed_at when it ends, so it never auto-shows again.
   * A manual replay from Settings never sets this, so replaying doesn't
   * touch the "have they seen it" record at all. */
  markCompleteOnEnd?: boolean;
}

interface TourContextValue {
  startTour: (tour: Tour, options?: StartOptions) => void;
  replayOnboardingTour: () => void;
  isTourActive: boolean;
}

const TourContext = React.createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { data: profile } = useProfile();
  const completeTour = useCompleteTour();
  const { celebrate } = useCelebration();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTour, setActiveTour] = React.useState<Tour | null>(null);
  const [stepIndex, setStepIndex] = React.useState(0);
  const optionsRef = React.useRef<StartOptions>({});
  const autoStartedRef = React.useRef(false);

  const startTour = React.useCallback((tour: Tour, options: StartOptions = {}) => {
    optionsRef.current = options;
    setActiveTour(tour);
    setStepIndex(0);
  }, []);

  const replayOnboardingTour = React.useCallback(() => {
    // Every step's target lives on /app (the dashboard, its top-bar action,
    // and the always-mounted sidebar/bottom-nav links) — jump back there
    // first so a replay from, say, Settings still has something to point
    // at instead of quietly falling back to centered cards throughout.
    if (location.pathname !== "/app") {
      navigate("/app");
    }
    startTour(onboardingTour, { markCompleteOnEnd: false });
  }, [startTour, navigate, location.pathname]);

  const end = React.useCallback(
    (finished: boolean) => {
      if (optionsRef.current.markCompleteOnEnd) completeTour.mutate();
      setActiveTour(null);
      setStepIndex(0);
      if (finished) celebrate("Welcome to Bloom 🌸");
    },
    [completeTour, celebrate]
  );

  const next = React.useCallback(() => {
    setStepIndex((i) => {
      if (!activeTour) return i;
      if (i >= activeTour.steps.length - 1) {
        end(true);
        return i;
      }
      return i + 1;
    });
  }, [activeTour, end]);

  const back = React.useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const skip = React.useCallback(() => end(false), [end]);

  // Auto-start exactly once per mount: only after onboarding is done, only
  // if this account has never finished (or skipped) the tour before, and
  // only inside the app shell. profiles.tour_completed_at — not
  // localStorage — is what makes "only the very first time, on any device"
  // possible; see 0034_profile_tour_completed_at.sql.
  //
  // The ref is only flipped inside the timeout callback, not when merely
  // scheduling it. React 18 StrictMode intentionally mounts effects twice
  // in development (mount, cleanup, mount again) to surface exactly the bug
  // that flipping it too early causes: the first mount's timer gets
  // cancelled by the interposed cleanup, and if the ref were already true
  // by then, the second mount would see "already started" and never
  // reschedule — the tour would silently never appear.
  React.useEffect(() => {
    if (autoStartedRef.current) return;
    if (!profile?.onboarded_at || profile.tour_completed_at) return;
    if (!location.pathname.startsWith("/app")) return;
    const t = window.setTimeout(() => {
      autoStartedRef.current = true;
      startTour(onboardingTour, { markCompleteOnEnd: true });
    }, 600);
    return () => window.clearTimeout(t);
  }, [profile, location.pathname, startTour]);

  const value = React.useMemo(
    () => ({ startTour, replayOnboardingTour, isTourActive: Boolean(activeTour) }),
    [startTour, replayOnboardingTour, activeTour]
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {activeTour && (
        <TourOverlay tour={activeTour} stepIndex={stepIndex} onNext={next} onBack={back} onSkip={skip} onClose={skip} />
      )}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = React.useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}
