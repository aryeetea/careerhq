import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ThoughtBubble({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "accent";
}) {
  return (
    <div
      className={cn(
        "relative rounded-[1.6rem] border px-4 py-3 shadow-soft",
        tone === "accent"
          ? "border-primary/20 bg-primary/8 text-foreground"
          : "border-border/75 bg-card/88 text-foreground/80",
        className
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute -bottom-2 left-6 h-4 w-4 rounded-full border shadow-soft",
          tone === "accent" ? "border-primary/20 bg-primary/10" : "border-border/75 bg-card/92"
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "absolute -bottom-5 left-12 h-2.5 w-2.5 rounded-full border",
          tone === "accent" ? "border-primary/20 bg-primary/12" : "border-border/75 bg-card/95"
        )}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
