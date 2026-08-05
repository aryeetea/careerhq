import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-medium leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        neutral: "border-border/70 bg-card/70 text-foreground/86",
        primary: "border-primary/20 bg-primary/10 text-primary",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-gold/20 bg-gold/10 text-gold",
        muted: "border-border/60 bg-secondary/70 text-muted-foreground",
        interactive: "border-border/70 bg-card/70 text-foreground/86 hover:border-primary/30 hover:bg-primary/5",
        removable: "border-border/70 bg-card/70 pr-2 text-foreground/86",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface ChipProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof chipVariants> {
  asChild?: boolean;
}

export function Chip({ asChild = false, className, variant, ...props }: ChipProps) {
  const Comp = asChild ? Slot : "div";
  return <Comp className={cn(chipVariants({ variant }), className)} {...props} />;
}
