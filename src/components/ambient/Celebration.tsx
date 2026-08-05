import * as React from "react";
import { usePrefersReducedMotion } from "@/hooks/useTheme";

interface CelebrationContextValue {
  celebrate: (message?: string) => void;
}

const CelebrationContext = React.createContext<CelebrationContextValue | null>(null);

const PETAL_COLORS = ["hsl(var(--rose))", "hsl(var(--gold))", "hsl(var(--lavender))", "hsl(var(--peach))", "hsl(var(--sage))"];

/**
 * A brief, tasteful celebration — a handful of soft petals drifting down
 * for under two seconds, plus a small toast-like message. Used when an
 * offer is recorded or a weekly goal is completed. Never loops, never
 * repeats on its own. Reduced-motion users get the message only.
 */
export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [burst, setBurst] = React.useState<{ id: number; message?: string } | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const idRef = React.useRef(0);

  const celebrate = React.useCallback((message?: string) => {
    const id = ++idRef.current;
    setBurst({ id, message });
    window.setTimeout(() => {
      setBurst((b) => (b?.id === id ? null : b));
    }, 1800);
  }, []);

  const value = React.useMemo(() => ({ celebrate }), [celebrate]);

  const petals = React.useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: 5 + Math.random() * 90,
        delay: Math.random() * 0.4,
        duration: 1.1 + Math.random() * 0.6,
        color: PETAL_COLORS[i % PETAL_COLORS.length],
        rotate: Math.random() * 360,
      })),
    [burst?.id]
  );

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {burst && (
        <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden" aria-live="polite">
          {!reducedMotion &&
            petals.map((p, i) => (
              <span
                key={i}
                className="absolute top-[-5%] block h-2.5 w-2.5 rounded-full opacity-80"
                style={{
                  left: `${p.left}%`,
                  backgroundColor: p.color,
                  animation: `celebration-fall ${p.duration}s ease-in ${p.delay}s forwards`,
                  transform: `rotate(${p.rotate}deg)`,
                }}
              />
            ))}
          {burst.message && (
            <div className="absolute left-1/2 top-10 -translate-x-1/2 animate-slide-up rounded-full glass-strong px-5 py-2.5 text-sm font-medium shadow-lift">
              {burst.message}
            </div>
          )}
        </div>
      )}
      <style>{`
        @keyframes celebration-fall {
          to { transform: translateY(105vh) rotate(200deg); opacity: 0; }
        }
      `}</style>
    </CelebrationContext.Provider>
  );
}

export function useCelebration() {
  const ctx = React.useContext(CelebrationContext);
  if (!ctx) throw new Error("useCelebration must be used within CelebrationProvider");
  return ctx;
}
