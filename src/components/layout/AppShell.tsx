import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { AmbientBackground } from "@/components/ambient/AmbientBackground";
import { CelebrationProvider } from "@/components/ambient/Celebration";

export function AppShell() {
  return (
    <CelebrationProvider>
      <div className="relative flex min-h-screen bg-background">
        <AmbientBackground />
        <Sidebar />
        <div className="relative z-10 flex min-h-screen flex-1 flex-col pb-24 lg:pb-0">
          <Outlet />
        </div>
        <MobileNav />
      </div>
    </CelebrationProvider>
  );
}
