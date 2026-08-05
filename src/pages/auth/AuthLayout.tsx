import type { ReactNode } from "react";
import { Briefcase } from "lucide-react";
import { AmbientBackground } from "@/components/ambient/AmbientBackground";
import { BotanicalAccent } from "@/components/ambient/BotanicalAccent";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <AmbientBackground />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-7 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <Briefcase className="h-4.5 w-4.5" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">CareerHQ</span>
        </div>

        <div className="glass-strong relative overflow-hidden rounded-2xl p-7 sm:p-8">
          <BotanicalAccent className="pointer-events-none absolute -right-6 -top-8 h-40 w-32 rotate-12" />
          <div className="relative">
            <h1 className="font-display text-xl font-semibold tracking-tight text-balance">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
