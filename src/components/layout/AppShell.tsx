import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { AmbientBackground } from "@/components/ambient/AmbientBackground";
import { CelebrationProvider } from "@/components/ambient/Celebration";
import { TourProvider } from "@/components/tour/TourProvider";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

export function AppShell() {
  const location = useLocation();
  return (
    <CelebrationProvider>
      {/* Inside CelebrationProvider: the tour's finale reuses the same
          soft-petals celebration used for offers and weekly goals, rather
          than a second bespoke confetti effect. */}
      <TourProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lift"
        >
          Skip to main content
        </a>
        <div className="relative flex min-h-screen bg-background">
          <AmbientBackground />
          <Sidebar />
          <div id="main-content" tabIndex={-1} className="relative z-10 flex min-h-screen flex-1 flex-col pb-24 outline-none lg:pb-0">
            {/* Keyed on pathname so navigating away from a crashed page resets
                the boundary instead of getting stuck on the fallback. Nav
                chrome (Sidebar/MobileNav) lives outside this boundary, so a
                page-level crash never takes out the ability to navigate away. */}
            <ErrorBoundary key={location.pathname} variant="page">
              <Outlet />
            </ErrorBoundary>
          </div>
          <MobileNav />
        </div>
      </TourProvider>
    </CelebrationProvider>
  );
}
