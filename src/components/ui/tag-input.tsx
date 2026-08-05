import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  maxItems?: number;
}

function normalizeTag(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

export function TagInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  disabled = false,
  maxItems,
}: TagInputProps) {
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  function commitTag(raw: string) {
    const next = normalizeTag(raw);
    if (!next) return;
    if (value.some((tag) => tag.toLowerCase() === next.toLowerCase())) return;
    if (typeof maxItems === "number" && value.length >= maxItems) return;
    onChange([...value, next]);
    setDraft("");
  }

  function removeTag(index: number) {
    onChange(value.filter((_, currentIndex) => currentIndex !== index));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitTag(draft);
      return;
    }

    if (event.key === "Backspace" && !draft && value.length > 0) {
      event.preventDefault();
      const lastTag = value[value.length - 1];
      onChange(value.slice(0, -1));
      setDraft(lastTag ?? "");
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-11 w-full flex-wrap items-center gap-2 rounded-2xl border border-input/90 bg-card/95 px-3.5 py-2 shadow-soft transition-[border-color,box-shadow,background-color] focus-within:ring-2 focus-within:ring-ring/30 focus-within:ring-offset-1 focus-within:ring-offset-background disabled:cursor-not-allowed disabled:bg-muted/45 disabled:opacity-65",
        disabled && "pointer-events-none"
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
        >
          {tag}
          <button
            type="button"
            className="rounded-full p-0.5 text-secondary-foreground/75 transition-colors hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            onClick={() => removeTag(index)}
            aria-label={`Remove ${tag}`}
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft) commitTag(draft);
        }}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ""}
        aria-label={ariaLabel}
        disabled={disabled}
        className="min-w-[10rem] flex-1 bg-transparent text-sm placeholder:text-muted-foreground/90 focus:outline-none"
      />
    </div>
  );
}
