import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Board = lazy(() => import("@/pages/Board"));
const ProfilePage = lazy(() => import("@/pages/Profile"));
const Resumes = lazy(() => import("@/pages/Resumes"));
const Certifications = lazy(() => import("@/pages/Certifications"));
const Friends = lazy(() => import("@/pages/Friends"));
const Groups = lazy(() => import("@/pages/Groups"));
const GroupDetail = lazy(() => import("@/pages/GroupDetail"));
const Goals = lazy(() => import("@/pages/Goals"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const NotFound = lazy(() => import("@/pages/NotFound"));

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <TooltipProvider delayDuration={200}>
            <AuthProvider>
              <BrowserRouter>
                <Suspense fallback={<FullScreenSpinner />}>
                <ErrorBoundary variant="app">
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
                          <Route path="board" element={<Board />} />
                          <Route path="profile" element={<ProfilePage />} />
                          <Route path="resumes" element={<Resumes />} />
                          <Route path="certifications" element={<Certifications />} />
                          <Route path="goals" element={<Goals />} />
                          <Route path="friends" element={<Friends />} />
                          <Route path="groups" element={<Groups />} />
                          <Route path="groups/:groupId" element={<GroupDetail />} />
                          <Route path="settings" element={<SettingsPage />} />
                        </Route>
                      </Route>
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </ErrorBoundary>
                </Suspense>
              </BrowserRouter>
            </AuthProvider>
          </TooltipProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
