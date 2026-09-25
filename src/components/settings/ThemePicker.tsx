import * as React from "react";
import { Check, Flower2, Leaf, Moon, Save, Sparkles, Sprout, Square, Sunrise } from "lucide-react";
import { useTheme, type FontName } from "@/hooks/useTheme";
import { useSettings, useUpdateSettings } from "@/hooks/queries/useProfile";
import { useToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import type { ThemeName } from "@/types/database";
import { cn } from "@/lib/utils";

const THEMES: { id: ThemeName; label: string; description: string; icon: typeof Flower2; preview: string[] }[] = [
  { id: "growth", label: "Growth", description: "Fresh greens, warm light, and steady progress", icon: Sprout, preview: ["#f2f8f1", "#3d8c5a", "#f2c96d"] },
  { id: "comic-pop", label: "Comic Pop", description: "Halftones, inked panels, and bold hero colors", icon: Sparkles, preview: ["#fff7f0", "#ff6b6b", "#7c4dff"] },
  { id: "candy", label: "Candy", description: "Pastel sweetness with a cheerful, bubbly feel", icon: Flower2, preview: ["#fff0f5", "#ff8fab", "#7dd3a1"] },
  { id: "sunrise", label: "Sunrise", description: "Apricot, coral, and buttercream", icon: Sunrise, preview: ["#fff2e3", "#ef8e72", "#f2c86b"] },
  { id: "floral", label: "Floral", description: "Warm ivory, rose, and sage", icon: Flower2, preview: ["#fbf3ea", "#d98b93", "#8fae95"] },
  { id: "neutral", label: "Neutral", description: "Clean and calm, less color", icon: Square, preview: ["#f7f6f3", "#46527a", "#c9c4b8"] },
  { id: "meadow", label: "Meadow", description: "Soft greens with a fresh notebook feel", icon: Leaf, preview: ["#f5f8ef", "#7ca26a", "#d7bf8a"] },
  { id: "dark", label: "Dark", description: "Warm charcoal, easy at night", icon: Moon, preview: ["#17151c", "#e08a96", "#2a2733"] },
  { id: "midnight", label: "Midnight", description: "Deep ink, lilac glow, and electric blue", icon: Moon, preview: ["#111827", "#8b7cf6", "#60a5fa"] },
];

const FONTS: { id: FontName; label: string; sample: string }[] = [
  { id: "inter", label: "Inter", sample: "Aa" },
  { id: "space-grotesk", label: "Space Grotesk", sample: "Aa" },
  { id: "comic-neue", label: "Comic Neue", sample: "Aa" },
  { id: "fredoka", label: "Fredoka", sample: "Aa" },
];

export function ThemePicker() {
  const { theme, setTheme, font, setFont } = useTheme();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { push } = useToast();
  const [draftTheme, setDraftTheme] = React.useState(theme);
  const [draftFont, setDraftFont] = React.useState(font);
  const [lastSavedTheme, setLastSavedTheme] = React.useState<ThemeName | null>(settings?.theme ?? null);
  const [lastSavedFont, setLastSavedFont] = React.useState<FontName | null>(font);

  React.useEffect(() => {
    if (settings?.theme) {
      setLastSavedTheme(settings.theme);
    }
  }, [settings?.theme]);

  const hasChanges = draftTheme !== lastSavedTheme || draftFont !== lastSavedFont;

  function chooseTheme(id: ThemeName) {
    setDraftTheme(id);
    setTheme(id);
  }

  function chooseFont(id: FontName) {
    setDraftFont(id);
    setFont(id);
  }

  async function savePreferences() {
    try {
      if (draftTheme !== lastSavedTheme) {
        await updateSettings.mutateAsync({ theme: draftTheme });
      }
      setLastSavedTheme(draftTheme);
      setLastSavedFont(draftFont);
      setTheme(draftTheme);
      setFont(draftFont);
      push("Theme and font saved.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save that theme.", "error");
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Font</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FONTS.map((option) => {
            const active = draftFont === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => chooseFont(option.id)}
                className={cn(
                  "rounded-2xl border px-3 py-2 text-left transition-all",
                  active ? "border-primary bg-primary/5 shadow-soft ring-1 ring-primary/30" : "border-border hover:border-primary/30"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold" style={{ fontFamily: option.id === "comic-neue" ? '"Comic Neue", "Fredoka", sans-serif' : option.id === "fredoka" ? '"Fredoka", "Comic Neue", sans-serif' : option.id === "space-grotesk" ? '"Space Grotesk", "Inter", sans-serif' : '"Inter", "Segoe UI", sans-serif' }}>
                    {option.sample}
                  </span>
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <p className="mt-2 text-sm font-medium">{option.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Theme</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {THEMES.map((t) => {
            const active = draftTheme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => chooseTheme(t.id)}
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
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={savePreferences} disabled={!hasChanges || updateSettings.isPending}>
          <Save />
          {updateSettings.isPending ? "Saving..." : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
