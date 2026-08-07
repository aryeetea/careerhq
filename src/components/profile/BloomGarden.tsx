import * as React from "react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { computeGardenStages } from "@/lib/garden";
import { cn, formatDate } from "@/lib/utils";
import type { Job, Resume } from "@/types/database";

const DESKTOP_CARD_WIDTH = 224;

// Content only, no outer card — the visual centerpiece of the merged
// Progress section (see ProgressSection.tsx).
export function BloomGarden({ jobs, resumes, accountCreatedAt }: { jobs: Job[]; resumes: Resume[]; accountCreatedAt: string }) {
  const stages = computeGardenStages(jobs, resumes, accountCreatedAt);
  const blossomedCount = stages.filter((stage) => stage.unlocked).length;
  const nextStage = stages.find((stage) => stage.isNext) ?? null;
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const updateScrollState = React.useCallback(() => {
    const node = trackRef.current;
    if (!node) return;
    const maxScrollLeft = node.scrollWidth - node.clientWidth;
    setCanScrollLeft(node.scrollLeft > 8);
    setCanScrollRight(node.scrollLeft < maxScrollLeft - 8);
  }, []);

  React.useEffect(() => {
    updateScrollState();
  }, [updateScrollState, stages.length]);

  React.useEffect(() => {
    const node = trackRef.current;
    if (!node) return;
    const onScroll = () => updateScrollState();
    node.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  function scrollTrack(direction: "left" | "right") {
    const node = trackRef.current;
    if (!node) return;
    const amount = Math.max(node.clientWidth - 120, DESKTOP_CARD_WIDTH + 24);
    node.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }

  return (
    <div className="pt-1">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight">Bloom Garden</h3>
          <p className="mt-1 text-sm text-foreground/72">
            {blossomedCount === 1 ? "1 milestone has blossomed." : `${blossomedCount} milestones have blossomed.`}
          </p>
        </div>
        <p className="text-sm font-medium text-primary/90">
          {nextStage ? `Next bloom: ${nextStage.milestoneLabel}` : "Your garden is in full bloom"}
        </p>
      </div>

      <div className="mt-8 hidden lg:block">
        <div className="mb-4 flex items-center justify-end gap-2">
          <TrackButton
            direction="left"
            disabled={!canScrollLeft}
            onClick={() => scrollTrack("left")}
            label="Scroll Bloom Garden milestones left"
          />
          <TrackButton
            direction="right"
            disabled={!canScrollRight}
            onClick={() => scrollTrack("right")}
            label="Scroll Bloom Garden milestones right"
          />
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 top-[6.6rem] h-[3px] rounded-full bg-border/55"
          />
          <div
            ref={trackRef}
            tabIndex={0}
            role="region"
            aria-label="Bloom Garden milestone track"
            className="overflow-x-auto pb-3 outline-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex min-w-max gap-6 pr-2">
              {stages.map((stage, index) => (
                <GardenStageCard key={stage.key} stage={stage} index={index} orientation="desktop" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:hidden">
        {stages.map((stage, index) => (
          <GardenStageCard key={stage.key} stage={stage} index={index} orientation="mobile" />
        ))}
      </div>
    </div>
  );
}

function TrackButton({
  direction,
  disabled,
  onClick,
  label,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/80 text-foreground shadow-soft transition-colors",
        disabled ? "cursor-not-allowed text-muted-foreground/50" : "hover:border-primary/35 hover:text-primary"
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function GardenStageCard({
  stage,
  index,
  orientation,
}: {
  stage: ReturnType<typeof computeGardenStages>[number];
  index: number;
  orientation: "desktop" | "mobile";
}) {
  const state = stage.unlocked ? "complete" : stage.isNext ? "next" : "locked";

  return (
    <div
      className={cn(
        "relative",
        orientation === "desktop" ? "w-56 shrink-0 pt-10" : "pl-16"
      )}
    >
      {orientation === "desktop" ? (
        <>
          {index < 6 && (
            <div
              aria-hidden="true"
              className={cn(
                "absolute left-[calc(100%-0.5rem)] top-[6.55rem] h-[3px] w-8 rounded-full",
                state === "complete" ? "bg-primary/65" : "bg-border/60"
              )}
            />
          )}
          <div className="absolute left-5 top-0 z-10">
            <PlantStageIcon stageIndex={index} state={state} />
          </div>
        </>
      ) : (
        <>
          {index < 6 && (
            <div
              aria-hidden="true"
              className={cn(
                "absolute left-[1.7rem] top-[5.8rem] h-[calc(100%+0.9rem)] border-l-[3px] border-dashed",
                state === "complete" ? "border-primary/55" : "border-border/65"
              )}
            />
          )}
          <div className="absolute left-0 top-0 z-10">
            <PlantStageIcon stageIndex={index} state={state} compact />
          </div>
        </>
      )}

      <article
        className={cn(
          "relative rounded-[30px] border bg-card/75 px-5 pb-5 pt-16 shadow-soft backdrop-blur-sm",
          state === "complete" && "border-primary/28 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.72))]",
          state === "next" && "border-primary/45 bg-[linear-gradient(180deg,rgba(255,248,239,0.96),rgba(255,255,255,0.78))] ring-1 ring-primary/20 shadow-[0_12px_40px_rgba(214,140,122,0.12)]",
          state === "locked" && "border-border/65 bg-[linear-gradient(180deg,rgba(248,247,245,0.92),rgba(255,255,255,0.7))]"
        )}
      >
        <div className="flex min-h-[8.75rem] flex-col">
          <div className="flex items-start justify-between gap-3">
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.18em]",
                state === "complete" ? "text-primary/80" : state === "next" ? "text-primary" : "text-muted-foreground"
              )}
            >
              {stage.growthLabel}
            </p>
            {stage.isNext && !stage.unlocked ? (
              <span className="rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-semibold text-primary">Next</span>
            ) : null}
          </div>

          <h4 className="mt-2 text-lg font-semibold leading-6 text-foreground">{stage.milestoneLabel}</h4>
          <p className="mt-2 text-sm leading-6 text-foreground/72">{stage.description}</p>

          <div className="mt-auto pt-4">
            {stage.unlocked && stage.unlockedAt ? (
              <p className="border-t border-border/45 pt-3 text-xs text-muted-foreground">Blossomed {formatDate(stage.unlockedAt)}</p>
            ) : stage.isNext ? (
              <p className="border-t border-primary/15 pt-3 text-xs font-medium text-primary/90">Next milestone</p>
            ) : (
              <p className="flex items-center gap-1.5 border-t border-border/45 pt-3 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 shrink-0" /> Locked for now
              </p>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

function PlantStageIcon({
  stageIndex,
  state,
  compact = false,
}: {
  stageIndex: number;
  state: "complete" | "next" | "locked";
  compact?: boolean;
}) {
  const bloom = stageIndex >= 4;
  const leaves = Math.min(stageIndex + 1, 4);
  const active = state !== "locked";

  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/55 bg-[radial-gradient(circle_at_top,_rgba(219,181,117,0.24),_transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.44))] shadow-soft",
        compact ? "p-1.5" : "p-2.5",
        state === "next" && "ring-2 ring-primary/20 motion-reduce:ring-1"
      )}
    >
      <svg viewBox="0 0 84 84" className={cn(compact ? "h-16 w-16" : "h-20 w-20")} aria-hidden="true">
        <defs>
          <linearGradient id={`stem-${stageIndex}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={active ? "#7ea86d" : "#aeb4ab"} />
            <stop offset="100%" stopColor={active ? "#5f7f4f" : "#bcc1bb"} />
          </linearGradient>
        </defs>
        <path d="M42 74 C38 58, 39 46, 42 32 C45 18, 53 10, 60 8" fill="none" stroke={`url(#stem-${stageIndex})`} strokeWidth="4.5" strokeLinecap="round" />
        {Array.from({ length: leaves }).map((_, leafIndex) => {
          const y = 58 - leafIndex * 11;
          const x = leafIndex % 2 === 0 ? 32 : 51;
          const rotate = leafIndex % 2 === 0 ? -28 : 28;
          return (
            <ellipse
              key={leafIndex}
              cx={x}
              cy={y}
              rx="9"
              ry="5"
              transform={`rotate(${rotate} ${x} ${y})`}
              fill={active ? "#94bf7e" : "#c9cdc8"}
            />
          );
        })}
        {stageIndex <= 1 && <circle cx="59" cy="12" r={stageIndex === 0 ? 6 : 7} fill={active ? "#8aa06e" : "#c7cbc5"} />}
        {stageIndex === 2 && <path d="M53 16 C57 9, 67 9, 69 17 C65 23, 57 24, 53 16 Z" fill={active ? "#b2cc84" : "#d4d8d1"} />}
        {stageIndex === 3 && <path d="M51 18 C54 9, 67 9, 69 18 C65 25, 56 27, 51 18 Z" fill={active ? "#d7a96b" : "#d9d4cd"} />}
        {bloom && (
          <>
            <circle cx="60" cy="16" r={stageIndex === 6 ? 11 : stageIndex === 5 ? 9.5 : 8} fill={active ? "#f6d4cf" : "#ddd8d4"} />
            <g fill={active ? "#d98b93" : "#cbc6c1"}>
              <ellipse cx="60" cy="8" rx="5" ry="8" />
              <ellipse cx="68" cy="16" rx="5" ry="8" transform="rotate(90 68 16)" />
              <ellipse cx="60" cy="24" rx="5" ry="8" />
              <ellipse cx="52" cy="16" rx="5" ry="8" transform="rotate(90 52 16)" />
              {(stageIndex >= 5 || active) && <ellipse cx="66" cy="10.5" rx="4.5" ry="7" transform="rotate(35 66 10.5)" />}
              {stageIndex === 6 && <ellipse cx="54" cy="10.5" rx="4.5" ry="7" transform="rotate(-35 54 10.5)" />}
            </g>
            <circle cx="60" cy="16" r="3.7" fill={active ? "#f5ddb1" : "#d9d4cf"} />
          </>
        )}
      </svg>
    </div>
  );
}
