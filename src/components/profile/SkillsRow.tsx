import * as React from "react";
import { Chip } from "@/components/ui/chip";

const INITIAL_COUNT = 8;

/** Shows a small, calm number of skills up front — the rest collapse behind
 * a quiet "+N more" rather than turning the profile into a wall of chips. */
export function SkillsRow({ skills }: { skills: string[] }) {
  const [expanded, setExpanded] = React.useState(false);
  if (skills.length === 0) return null;

  const visible = expanded ? skills : skills.slice(0, INITIAL_COUNT);
  const remaining = skills.length - INITIAL_COUNT;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((skill) => (
        <Chip key={skill} variant="neutral">{skill}</Chip>
      ))}
      {!expanded && remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex min-h-8 items-center rounded-full border border-dashed border-border/70 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
        >
          +{remaining} more
        </button>
      )}
    </div>
  );
}
