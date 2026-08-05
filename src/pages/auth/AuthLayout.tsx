import type { ReactNode } from "react";
import { AmbientBackground } from "@/components/ambient/AmbientBackground";
import { BotanicalAccent } from "@/components/ambient/BotanicalAccent";
import { BrandMark } from "@/components/shared/BrandMark";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <AmbientBackground />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-7 flex items-center justify-center gap-2.5">
          <BrandMark size="lg" />
          <span className="font-display text-lg font-semibold tracking-tight">Bloom</span>
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
