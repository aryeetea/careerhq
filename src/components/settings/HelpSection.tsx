import { Compass } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTour } from "@/components/tour/TourProvider";

export function HelpSection() {
  const { replayOnboardingTour } = useTour();

  return (
    <div className="grid gap-4">
      <Card className="border-border/60 bg-card/60">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Compass className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Replay product tour</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A quick, thirty-second look around the dashboard, board, resumes, profile, and friends.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={replayOnboardingTour}>
            Replay tour
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
