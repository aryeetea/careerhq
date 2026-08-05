import { Card, CardContent } from "@/components/ui/card";
import { computeGardenStages } from "@/lib/garden";
import { cn, formatDate } from "@/lib/utils";
import type { Job, Resume } from "@/types/database";

export function BloomGarden({ jobs, resumes, accountCreatedAt }: { jobs: Job[]; resumes: Resume[]; accountCreatedAt: string }) {
  const stages = computeGardenStages(jobs, resumes, accountCreatedAt);
  const blossomedCount = stages.filter((stage) => stage.unlocked).length;
  const nextStage = stages.find((stage) => stage.isNext) ?? null;

  return (
    <Card className="glass-subtle overflow-hidden border-border/60">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-display text-xl font-semibold tracking-tight">Bloom Garden</h3>
            <p className="mt-1 text-sm text-foreground/76">
              {blossomedCount <= 1 ? "Your garden is growing." : `${blossomedCount} milestones have blossomed.`}
            </p>
          </div>
          <p className="text-sm font-medium text-primary/90">
            {nextStage ? `Next bloom: ${nextStage.milestoneLabel}` : "Your garden is in full bloom"}
          </p>
        </div>

        <div className="mt-6 hidden grid-cols-7 gap-3 lg:grid">
          {stages.map((stage, index) => (
            <GardenStageCard key={stage.key} stage={stage} index={index} orientation="horizontal" />
          ))}
        </div>

        <div className="mt-6 grid gap-3 lg:hidden">
          {stages.map((stage, index) => (
            <GardenStageCard key={stage.key} stage={stage} index={index} orientation="vertical" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GardenStageCard({
  stage,
  index,
  orientation,
}: {
  stage: ReturnType<typeof computeGardenStages>[number];
  index: number;
  orientation: "horizontal" | "vertical";
}) {
  return (
    <div
      className={cn(
        "relative",
        orientation === "horizontal"
          ? "min-w-0 rounded-[28px] border border-border/55 bg-card/50 p-3.5"
          : "rounded-[24px] border border-border/55 bg-card/50 p-4"
      )}
    >
      {orientation === "horizontal" && index < 6 && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute left-[72%] top-[3.35rem] h-4 w-[52%] rounded-full border-t-2 border-dashed",
            stage.unlocked ? "border-primary/45" : "border-border/60"
          )}
        />
      )}
      <div className={cn("flex gap-3", orientation === "horizontal" ? "flex-col items-start" : "items-start")}>
        <div className="relative shrink-0">
          <PlantStageIcon stageIndex={index} unlocked={stage.unlocked} isNext={stage.isNext} />
          {orientation === "vertical" && index < 6 && (
            <div
              aria-hidden="true"
              className={cn(
                "absolute left-1/2 top-[4.3rem] h-10 -translate-x-1/2 border-l-2 border-dashed",
                stage.unlocked ? "border-primary/45" : "border-border/60"
              )}
            />
          )}
        </div>
        <div className="min-w-0">
          <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", stage.unlocked ? "text-primary/80" : "text-muted-foreground")}>
            {stage.growthLabel}
          </p>
          <p className="mt-1 font-medium text-foreground">{stage.milestoneLabel}</p>
          <p className="mt-1 text-sm leading-6 text-foreground/72">{stage.description}</p>
          {stage.unlocked && stage.unlockedAt ? (
            <p className="mt-2 text-xs text-muted-foreground">Blossomed {formatDate(stage.unlockedAt)}</p>
          ) : stage.isNext ? (
            <p className="mt-2 text-xs font-medium text-primary/90">This is the next milestone your garden is reaching for.</p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Waiting quietly for its season.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PlantStageIcon({ stageIndex, unlocked, isNext }: { stageIndex: number; unlocked: boolean; isNext: boolean }) {
  const bloom = stageIndex >= 4;
  const leaves = Math.min(stageIndex + 1, 4);

  return (
    <div
      className={cn(
        "rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(219,181,117,0.26),_transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.75),rgba(255,255,255,0.2))] p-2 shadow-soft",
        unlocked ? "opacity-100" : "opacity-65 saturate-50",
        isNext && "ring-2 ring-primary/20 motion-safe:animate-pulse"
      )}
    >
      <svg viewBox="0 0 84 84" className="h-20 w-20" aria-hidden="true">
        <defs>
          <linearGradient id={`stem-${stageIndex}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={unlocked ? "#7ea86d" : "#b7c0b0"} />
            <stop offset="100%" stopColor={unlocked ? "#5f7f4f" : "#c9cec4"} />
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
              fill={unlocked ? "#94bf7e" : "#d2d7ce"}
            />
          );
        })}
        {stageIndex <= 1 && <circle cx="59" cy="12" r={stageIndex === 0 ? 6 : 7} fill={unlocked ? "#8aa06e" : "#d0d5ca"} />}
        {stageIndex === 2 && <path d="M53 16 C57 9, 67 9, 69 17 C65 23, 57 24, 53 16 Z" fill={unlocked ? "#b2cc84" : "#d9ddd3"} />}
        {stageIndex === 3 && <path d="M51 18 C54 9, 67 9, 69 18 C65 25, 56 27, 51 18 Z" fill={unlocked ? "#d7a96b" : "#ddd7cf"} />}
        {bloom && (
          <>
            <circle cx="60" cy="16" r={stageIndex === 6 ? 11 : stageIndex === 5 ? 9.5 : 8} fill={unlocked ? "#f6d4cf" : "#e2ddd8"} />
            <g fill={unlocked ? "#d98b93" : "#d3cdc8"}>
              <ellipse cx="60" cy="8" rx="5" ry="8" />
              <ellipse cx="68" cy="16" rx="5" ry="8" transform="rotate(90 68 16)" />
              <ellipse cx="60" cy="24" rx="5" ry="8" />
              <ellipse cx="52" cy="16" rx="5" ry="8" transform="rotate(90 52 16)" />
              {(stageIndex >= 5 || unlocked) && <ellipse cx="66" cy="10.5" rx="4.5" ry="7" transform="rotate(35 66 10.5)" />}
              {stageIndex === 6 && <ellipse cx="54" cy="10.5" rx="4.5" ry="7" transform="rotate(-35 54 10.5)" />}
            </g>
            <circle cx="60" cy="16" r="3.7" fill={unlocked ? "#f5ddb1" : "#dedad5"} />
          </>
        )}
      </svg>
    </div>
  );
}
