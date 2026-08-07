import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto px-4 pb-12 pt-7 sm:px-8 sm:pb-14 sm:pt-8 lg:px-10 lg:pb-16 lg:pt-9", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function PageContainer({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("mx-auto w-full", className)} {...props}>
      {children}
    </div>
  );
}
