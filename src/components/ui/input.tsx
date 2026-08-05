import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-2xl border border-input/90 bg-card/95 px-3.5 py-2 text-sm shadow-soft transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-muted/45 disabled:opacity-65 aria-[invalid=true]:border-destructive/60 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/15",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
