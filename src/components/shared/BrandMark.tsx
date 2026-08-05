import { Flower2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "h-7 w-7 rounded-lg", icon: "h-3.5 w-3.5" },
  md: { box: "h-8 w-8 rounded-xl", icon: "h-4 w-4" },
  lg: { box: "h-9 w-9 rounded-xl", icon: "h-4.5 w-4.5" },
} as const;

/**
 * Bloom's mark: a flower glyph in a soft rounded square. One shared
 * component so the logo never drifts between the sidebar, auth screens,
 * and the landing page.
 */
export function BrandMark({ size = "md", className }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  return (
    <div className={cn("flex shrink-0 items-center justify-center bg-primary text-primary-foreground shadow-soft", s.box, className)}>
      <Flower2 className={s.icon} />
    </div>
  );
}
