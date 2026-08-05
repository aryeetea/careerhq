import { cn } from "@/lib/utils";

/**
 * A single delicate line-art sprig, used sparingly: a corner of the
 * dashboard header, an onboarding card, an empty state. Pure stroke, no
 * fill, so it never fights with text for attention. Color follows
 * `currentColor` — set it with a text-* utility on the wrapper.
 */
export function BotanicalAccent({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 160"
      fill="none"
      aria-hidden="true"
      className={cn("text-primary/25", className)}
    >
      <path
        d="M60 150C58 110 58 70 60 20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M60 100C48 92 36 92 26 84C36 82 48 84 60 90"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M60 70C72 62 84 62 94 54C84 52 72 54 60 60"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M60 130C50 124 40 124 32 118C40 116 50 118 60 122"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="60" cy="18" r="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="60" cy="18" r="2.5" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
