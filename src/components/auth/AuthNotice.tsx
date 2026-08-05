import * as React from "react";
import { AlertCircle, CheckCircle2, Info, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthNoticeVariant = "success" | "error" | "info" | "warning";

const styles: Record<AuthNoticeVariant, string> = {
  success: "border-success/20 bg-success/10 text-success",
  error: "border-destructive/20 bg-destructive/10 text-destructive",
  info: "border-primary/15 bg-card/75 text-foreground/80",
  warning: "border-gold/25 bg-gold/10 text-foreground/80",
};

const icons: Record<AuthNoticeVariant, React.ReactNode> = {
  success: <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />,
  error: <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />,
  info: <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />,
  warning: <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />,
};

export function AuthNotice({
  children,
  className,
  variant = "info",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: AuthNoticeVariant;
}) {
  const liveRole = variant === "error" ? "alert" : "status";

  return (
    <div
      role={liveRole}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cn("flex gap-2.5 rounded-2xl border px-4 py-3 text-sm shadow-soft", styles[variant], className)}
    >
      {icons[variant]}
      <div className="min-w-0 flex-1 leading-6">{children}</div>
    </div>
  );
}
