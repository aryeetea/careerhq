import * as React from "react";
import { MapPin, FileText, GripVertical, CalendarClock, CheckCircle2 } from "lucide-react";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import type { Job, Resume } from "@/types/database";
import { VerdictBadge } from "@/components/jobs/StatusBadge";
import { WORK_ARRANGEMENT_META, PRIORITY_META } from "@/lib/constants";
import { formatDate, initials, cn } from "@/lib/utils";
import { useSettings } from "@/hooks/queries/useProfile";

interface JobCardProps {
  job: Job;
  resume?: Resume;
  onClick: () => void;
  isDragging?: boolean;
  dragAttributes?: DraggableAttributes;
  dragListeners?: DraggableSyntheticListeners;
  style?: React.CSSProperties;
}

export const JobCard = React.forwardRef<HTMLDivElement, JobCardProps>(
  ({ job, resume, onClick, isDragging, dragAttributes, dragListeners, style }, ref) => {
    const { data: settings } = useSettings();
    const showAiFit = settings?.show_ai_fit_score ?? true;
    return (
      <div
        ref={ref}
        style={style}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(
          "hover-lift group cursor-pointer rounded-2xl border border-border bg-card p-3.5 shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDragging && "opacity-40"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-secondary to-secondary/60 text-[11px] font-semibold text-secondary-foreground">
              {initials(job.company)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight">{job.title}</p>
              <p className="truncate text-xs text-muted-foreground">{job.company}</p>
            </div>
          </div>
          <button
            {...dragAttributes}
            {...dragListeners}
            aria-label={`Reorder ${job.title} at ${job.company}`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 cursor-grab touch-none rounded-md p-1 text-muted-foreground/50 opacity-60 transition-opacity hover:bg-secondary hover:opacity-100 hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>

        {(job.location || job.work_arrangement) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {job.location}
                {job.work_arrangement ? ` · ${WORK_ARRANGEMENT_META[job.work_arrangement]}` : ""}
              </span>
            )}
          </div>
        )}

        {((showAiFit && (job.verdict || typeof job.fit_score === "number")) || job.priority === 3) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {showAiFit && job.verdict && <VerdictBadge verdict={job.verdict} />}
            {showAiFit && typeof job.fit_score === "number" && (
              <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {job.fit_score}/10 fit
              </span>
            )}
            {job.priority === 3 && <span className={cn("text-xs", PRIORITY_META[3].className)}>★ Priority</span>}
          </div>
        )}

        {(job.follow_up_date || job.ai_cover_letter) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {job.follow_up_date && (
              <span className="flex items-center gap-1 text-gold">
                <CalendarClock className="h-3 w-3" /> Follow up {formatDate(job.follow_up_date)}
              </span>
            )}
            {job.ai_cover_letter && (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="h-3 w-3" /> Cover letter ready
              </span>
            )}
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-between border-t border-border/70 pt-2 text-[11px] text-muted-foreground">
          <span>{job.date_applied ? `Applied ${formatDate(job.date_applied)}` : `Found ${formatDate(job.date_found)}`}</span>
          {resume && (
            <span className="flex max-w-[45%] items-center gap-1 truncate">
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{resume.name}</span>
            </span>
          )}
        </div>
      </div>
    );
  }
);
JobCard.displayName = "JobCard";
