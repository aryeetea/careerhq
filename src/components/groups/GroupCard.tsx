import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { GroupWithMembers } from "@/services/groups";

export function GroupCard({ group }: { group: GroupWithMembers }) {
  return (
    <Link to={`/app/groups/${group.id}`}>
      <Card className="hover-lift h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lavender/20 text-lavender-foreground">
              <Users className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{group.name}</p>
              {group.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{group.description}</p>}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{group.group_members.length} member{group.group_members.length === 1 ? "" : "s"}</span>
            {group.weekly_goal_target && <span>Goal: {group.weekly_goal_target}/week</span>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
