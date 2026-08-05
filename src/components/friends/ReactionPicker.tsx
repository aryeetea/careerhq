import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { HeartHandshake } from "lucide-react";
import { REACTION_META } from "@/lib/constants";
import type { ReactionContext, ReactionType } from "@/types/database";
import { useSendReaction } from "@/hooks/queries/useReactions";
import { useToast } from "@/components/shared/toast";

export function ReactionPicker({ recipientId, contextType, contextId }: { recipientId: string; contextType: ReactionContext; contextId?: string | null }) {
  const sendReaction = useSendReaction();
  const { push } = useToast();
  const [open, setOpen] = useState(false);

  async function send(type: ReactionType) {
    try {
      await sendReaction.mutateAsync({ recipientId, contextType, contextId, reactionType: type });
      push(`Sent "${REACTION_META[type].label}"`, "success");
      setOpen(false);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't send that.", "error");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={sendReaction.isPending}>
          <HeartHandshake className="h-3.5 w-3.5" /> Encourage
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="grid gap-0.5">
          {(Object.keys(REACTION_META) as ReactionType[]).map((type) => (
            <button
              key={type}
              onClick={() => send(type)}
              disabled={sendReaction.isPending}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-secondary"
            >
              <span className="text-base">{REACTION_META[type].emoji}</span>
              {REACTION_META[type].label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
