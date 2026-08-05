import { Check, Flower2, Leaf, Moon, Square, Sunrise } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { ThemeName } from "@/types/database";
import { cn } from "@/lib/utils";

const THEMES: { id: ThemeName; label: string; description: string; icon: typeof Flower2; preview: string[] }[] = [
  { id: "floral", label: "Floral", description: "Warm ivory, rose, and sage — the default", icon: Flower2, preview: ["#fbf3ea", "#d98b93", "#8fae95"] },
  { id: "neutral", label: "Neutral", description: "Clean and calm, less color", icon: Square, preview: ["#f7f6f3", "#46527a", "#c9c4b8"] },
  { id: "sunrise", label: "Sunrise", description: "Apricot, coral, and buttercream", icon: Sunrise, preview: ["#fff2e3", "#ef8e72", "#f2c86b"] },
  { id: "meadow", label: "Meadow", description: "Soft greens with a fresh notebook feel", icon: Leaf, preview: ["#f5f8ef", "#7ca26a", "#d7bf8a"] },
  { id: "dark", label: "Dark", description: "Warm charcoal, easy at night", icon: Moon, preview: ["#17151c", "#e08a96", "#2a2733"] },
  { id: "midnight", label: "Midnight", description: "Deep ink, lilac glow, and cool blue", icon: Moon, preview: ["#111827", "#8b7cf6", "#60a5fa"] },
];

export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {THEMES.map((t) => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={cn(
              "relative flex flex-col gap-2.5 rounded-2xl border p-4 text-left transition-all",
              active ? "border-primary shadow-soft ring-1 ring-primary/30" : "border-border hover:border-primary/30"
            )}
          >
            {active && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            )}
            <div className="flex gap-1.5">
              {t.preview.map((c, i) => (
                <span key={i} className="h-8 w-8 rounded-lg border border-black/5" style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </div>
            <p className="text-xs text-muted-foreground">{t.description}</p>
          </button>
        );
      })}
    </div>
  );
}
