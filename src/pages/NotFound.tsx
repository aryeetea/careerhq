import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BotanicalAccent } from "@/components/ambient/BotanicalAccent";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <BotanicalAccent className="h-24 w-20 opacity-50" />
      <h1 className="font-display text-2xl font-semibold">This page wandered off</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        We couldn't find what you were looking for. Let's get you back to somewhere familiar.
      </p>
      <Button asChild>
        <Link to="/app">Back to CareerHQ</Link>
      </Button>
    </div>
  );
}
