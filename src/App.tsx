import { Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ToastProvider } from "@/components/shared/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute, GuestOnlyRoute } from "@/routes/ProtectedRoute";
import { RequireOnboarding } from "@/routes/RequireOnboarding";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenSpinner } from "@/components/shared/FullScreenSpinner";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

import Landing from "@/pages/Landing";
import About from "@/pages/About";
import SignIn from "@/pages/auth/SignIn";
import SignUp from "@/pages/auth/SignUp";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import AuthCallback from "@/pages/auth/AuthCallback";
import JoinGroup from "@/pages/JoinGroup";
import LegacyFriendLink from "@/pages/LegacyFriendLink";

// Route-level code splitting: everything past the marketing/auth pages is
// lazy-loaded so first paint only ships what a signed-out visitor needs.
// lazyWithRetry (not React's plain lazy) because a chunk that 404s — a
// stale tab open across a deploy, or a one-off network blip — otherwise
// leaves that route permanently broken until a manual reload: React.lazy
// caches the rejected import() and keeps re-throwing it on every retry.
// See src/lib/lazyWithRetry.ts.
const Onboarding = lazyWithRetry(() => import("@/pages/Onboarding"));
const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const DashboardStatDetail = lazyWithRetry(() => import("@/pages/DashboardStatDetail"));
const Applications = lazyWithRetry(() => import("@/pages/Applications"));
const ProfilePage = lazyWithRetry(() => import("@/pages/Profile"));
const PeopleProfile = lazyWithRetry(() => import("@/pages/PeopleProfile"));
const Resumes = lazyWithRetry(() => import("@/pages/Resumes"));
const Certifications = lazyWithRetry(() => import("@/pages/Certifications"));
const CommunityLayout = lazyWithRetry(() => import("@/pages/community/CommunityLayout"));
const CommunityFriends = lazyWithRetry(() => import("@/pages/community/CommunityFriends"));
const CommunityGroups = lazyWithRetry(() => import("@/pages/community/CommunityGroups"));
const CommunityInvites = lazyWithRetry(() => import("@/pages/community/CommunityInvites"));
const GroupDetail = lazyWithRetry(() => import("@/pages/GroupDetail"));
const Goals = lazyWithRetry(() => import("@/pages/Goals"));
const Journal = lazyWithRetry(() => import("@/pages/Journal"));
const SettingsPage = lazyWithRetry(() => import("@/pages/Settings"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));

// Resets the app-level ErrorBoundary on every route change. Without this,
// ErrorBoundary sits above <Routes> and is never remounted by React Router,
// so one bad render (a stale chunk, a one-off crash) leaves every future
// navigation stuck on the same "Something broke" screen — keyed by pathname
// so only an actual navigation clears it, not e.g. a tab switch re-render.
function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname} variant="app">
      {children}
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <TooltipProvider delayDuration={200}>
            <AuthProvider>
              <BrowserRouter>
                <Suspense fallback={<FullScreenSpinner />}>
                <RouteErrorBoundary>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/join/group/:token" element={<JoinGroup />} />
                    <Route path="/join/friend/:token" element={<LegacyFriendLink />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />

                    <Route element={<GuestOnlyRoute />}>
                      <Route path="/login" element={<SignIn />} />
                      <Route path="/signup" element={<SignUp />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                    </Route>

                    {/* Reachable while signed in via a recovery-session link, so it is
                        NOT gated behind GuestOnlyRoute. */}
                    <Route element={<ProtectedRoute />}>
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/onboarding" element={<Onboarding />} />

                      <Route element={<RequireOnboarding />}>
                        <Route path="/app" element={<AppShell />}>
                          <Route index element={<Dashboard />} />
                          <Route path="dashboard/:kind" element={<DashboardStatDetail />} />
                          <Route path="applications" element={<Applications />} />
                          <Route path="profile" element={<ProfilePage />} />
                          <Route path="people/:userId" element={<PeopleProfile />} />
                          <Route path="resumes" element={<Resumes />} />
                          <Route path="certifications" element={<Certifications />} />
                          <Route path="goals" element={<Goals />} />
                          <Route path="journal" element={<Journal />} />

                          {/* Friends, Groups, and Invites used to be separate pages —
                              they're tabs under one Community layout now, so switching
                              between them never triggers a full page reload. */}
                          <Route path="community" element={<CommunityLayout />}>
                            <Route index element={<Navigate to="friends" replace />} />
                            <Route path="friends" element={<CommunityFriends />} />
                            <Route path="groups" element={<CommunityGroups />} />
                            <Route path="invites" element={<CommunityInvites />} />
                          </Route>
                          <Route path="groups/:groupId" element={<GroupDetail />} />

                          <Route path="settings" element={<SettingsPage />} />

                          {/* Legacy links (old bookmarks, old copy) still resolve. */}
                          <Route path="board" element={<Navigate to="/app/applications" replace />} />
                          <Route path="friends" element={<Navigate to="/app/community/friends" replace />} />
                          <Route path="groups" element={<Navigate to="/app/community/groups" replace />} />
                        </Route>
                      </Route>
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </RouteErrorBoundary>
                </Suspense>
              </BrowserRouter>
            </AuthProvider>
          </TooltipProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
