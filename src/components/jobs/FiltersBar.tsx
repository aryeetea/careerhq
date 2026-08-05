import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { Resume } from "@/types/database";
import { DEFAULT_FILTERS, type JobFilters } from "@/types/filters";
import { JOB_STATUSES } from "@/lib/constants";

export function FiltersBar({
  filters,
  onChange,
  resumes,
}: {
  filters: JobFilters;
  onChange: (f: JobFilters) => void;
  resumes: Resume[];
}) {
  const isFiltered =
    filters.search ||
    filters.status !== "all" ||
    filters.verdict !== "all" ||
    filters.resumeId !== "all" ||
    filters.workArrangement !== "all" ||
    filters.priority !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-8">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search company, title, location, recruiter…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-8"
          aria-label="Search jobs"
        />
      </div>

      <Select value={filters.status} onValueChange={(v) => onChange({ ...filters, status: v as JobFilters["status"] })}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {JOB_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.verdict} onValueChange={(v) => onChange({ ...filters, verdict: v as JobFilters["verdict"] })}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Verdict" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All verdicts</SelectItem>
          <SelectItem value="apply">🟢 Apply</SelectItem>
          <SelectItem value="maybe">🟡 Maybe</SelectItem>
          <SelectItem value="skip">🔴 Skip</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.workArrangement} onValueChange={(v) => onChange({ ...filters, workArrangement: v as JobFilters["workArrangement"] })}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Work mode" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All modes</SelectItem>
          <SelectItem value="remote">Remote</SelectItem>
          <SelectItem value="hybrid">Hybrid</SelectItem>
          <SelectItem value="onsite">Onsite</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.priority === "all" ? "all" : String(filters.priority)} onValueChange={(v) => onChange({ ...filters, priority: v === "all" ? "all" : Number(v) })}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          <SelectItem value="3">High priority</SelectItem>
          <SelectItem value="2">Normal priority</SelectItem>
          <SelectItem value="1">Low priority</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.resumeId} onValueChange={(v) => onChange({ ...filters, resumeId: v })}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Resume" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All resumes</SelectItem>
          {resumes.map((r) => (
            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isFiltered && (
        <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_FILTERS)}>
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
