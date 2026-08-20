import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ALL_BOARD_COLUMNS, STATUS_META } from "@/lib/constants";
import type { JobStatus } from "@/types/database";

export function ColumnVisibilityMenu({
  visibleColumns,
  onToggle,
}: {
  visibleColumns: Set<JobStatus>;
  onToggle: (status: JobStatus, visible: boolean) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Columns</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Show on board</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ALL_BOARD_COLUMNS.map((status) => (
          <DropdownMenuCheckboxItem
            key={status}
            checked={visibleColumns.has(status)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) => onToggle(status, checked)}
          >
            {STATUS_META[status].label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
