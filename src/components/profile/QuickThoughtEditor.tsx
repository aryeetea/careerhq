import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThoughtBubble } from "@/components/shared/ThoughtBubble";
import { useUpdateProfile } from "@/hooks/queries/useProfile";
import { useToast } from "@/components/shared/toast";

const MAX_LENGTH = 140;

// The one field on Bloom meant to change constantly — editable inline, on
// the Profile page itself, without opening Settings. Everything else about
// the profile is a considered edit; this one is a quick jot.
export function QuickThoughtEditor({ value }: { value: string | null }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");
  const updateProfile = useUpdateProfile();
  const { push } = useToast();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (editing) {
      setDraft(value ?? "");
      // Focus after the textarea mounts.
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [editing, value]);

  async function handleSave() {
    try {
      await updateProfile.mutateAsync({ status_message: draft.trim() || null });
      setEditing(false);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't update your thought.", "error");
    }
  }

  if (editing) {
    return (
      <ThoughtBubble tone="accent">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
            if (e.key === "Escape") setEditing(false);
          }}
          maxLength={MAX_LENGTH}
          rows={2}
          placeholder="Preparing for tomorrow's interview…"
          className="resize-none border-0 bg-transparent p-0 text-sm leading-6 shadow-none focus-visible:ring-0"
          aria-label="Today's thought"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{draft.length}/{MAX_LENGTH}</span>
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={updateProfile.isPending}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </ThoughtBubble>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-[1.6rem]"
      aria-label="Edit today's thought"
    >
      <ThoughtBubble tone={value ? "accent" : "default"}>
        <div className="flex items-start justify-between gap-2">
          {value ? (
            <p className="text-sm leading-6 text-foreground/82">{value}</p>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">Nothing jotted down today — tap to add a quick thought.</p>
          )}
          <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </ThoughtBubble>
    </button>
  );
}
