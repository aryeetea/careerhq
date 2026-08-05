import { Navigate, Outlet } from "react-router-dom";
import { useProfile } from "@/hooks/queries/useProfile";
import { FullScreenSpinner } from "@/components/shared/FullScreenSpinner";

export function RequireOnboarding() {
  const { data: profile, isLoading } = useProfile();

  if (isLoading) return <FullScreenSpinner />;
  if (!profile || !profile.onboarded_at) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}
