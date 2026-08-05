import * as React from "react";
import { AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  /** Distinguishes app-shell crashes from marketing/auth-page crashes in the fallback copy. */
  variant?: "app" | "page";
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time exceptions anywhere below it so one broken component
 * shows a recoverable message instead of a blank white screen. Query/fetch
 * errors are handled separately via ErrorState + isError — this only catches
 * actual thrown errors during render.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Unhandled render error:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertOctagon className="h-6 w-6" />
          </div>
          <div className="max-w-sm">
            <p className="font-display text-lg font-semibold">Something broke on this page</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {this.props.variant === "app"
                ? "Your data is safe — this is just a display problem. Reloading usually fixes it."
                : "Reloading usually fixes it. If it keeps happening, let us know."}
            </p>
          </div>
          <div className="mt-1 flex gap-2">
            <Button variant="outline" size="sm" onClick={this.reset}>
              Try again
            </Button>
            <Button size="sm" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
