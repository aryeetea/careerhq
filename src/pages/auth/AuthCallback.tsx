import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, LoaderCircle, Mail } from "lucide-react";
import { AuthLayout } from "@/pages/auth/AuthLayout";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

// How long we wait for a session to appear before assuming something (most
// likely the network) is stuck, rather than waiting forever.
const VERIFY_TIMEOUT_MS = 12000;

interface ParsedAuthError {
  code: string | null;
  description: string | null;
}

// Supabase appends failure details to the redirect as either query params or
// a URL hash fragment depending on flow — read both. Captured once, at
// module scope, so it runs as early as possible relative to the SDK's own
// (async) processing of this same URL, which may rewrite the hash once it
// finishes. Best-effort only: the actual success/failure determination below
// comes from the resolved session, not from these params, so a missed read
// here only makes the error message a little less specific, never wrong.
function parseAuthError(): ParsedAuthError {
  if (typeof window === "undefined") return { code: null, description: null };
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const code = search.get("error_code") ?? hash.get("error_code") ?? search.get("error") ?? hash.get("error");
  const rawDescription = search.get("error_description") ?? hash.get("error_description");
  return { code, description: rawDescription ? rawDescription.replace(/\+/g, " ") : null };
}

function describeFailure({ code, description }: ParsedAuthError): string {
  const haystack = `${code ?? ""} ${description ?? ""}`.toLowerCase();
  if (haystack.includes("expired")) {
    return "This sign-in link has expired. Request a fresh one below.";
  }
  if (haystack.includes("access_denied") || haystack.includes("invalid")) {
    return "This sign-in link is invalid — it may have already been used. Request a new one below.";
  }
  return "We couldn't verify that sign-in link. It may have expired or already been used — request a new one below.";
}

type CallbackStatus = "verifying" | "error" | "timeout";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const [initialError] = React.useState<ParsedAuthError>(parseAuthError);
  const [status, setStatus] = React.useState<CallbackStatus>(initialError.code ? "error" : "verifying");
  const next = searchParams.get("next") || "/app";

  // Safety net for a hung network request — never leave the user staring at
  // a spinner indefinitely.
  React.useEffect(() => {
    if (status !== "verifying") return;
    const timer = window.setTimeout(() => {
      setStatus((current) => (current === "verifying" ? "timeout" : current));
    }, VERIFY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  React.useEffect(() => {
    if (status !== "verifying" || loading) return;
    if (user) {
      // RequireOnboarding (already wrapping /app) sends incomplete profiles
      // to /onboarding on its own — no need to duplicate that check here.
      navigate(next, { replace: true });
    } else {
      setStatus("error");
    }
  }, [status, loading, user, next, navigate]);

  if (status === "verifying") {
    return (
      <AuthLayout title="Signing you in" subtitle="Just a moment — confirming your secure link.">
        <div className="flex flex-col items-center gap-3 py-6 text-center" role="status" aria-live="polite">
          <LoaderCircle className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">This only takes a second.</p>
        </div>
      </AuthLayout>
    );
  }

  if (status === "timeout") {
    return (
      <AuthLayout title="Still working on it" subtitle="This is taking longer than expected.">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <AuthNotice variant="warning" className="w-full text-left">
            Signing in is taking longer than expected. Check your connection — if it doesn't finish shortly, the link may need
            a fresh request.
          </AuthNotice>
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="flex-1" onClick={() => window.location.reload()}>
              Try again
            </Button>
            <Button asChild className="flex-1">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="That link didn't work" subtitle="No worries — let's get you a new one.">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <AuthNotice variant="error" className="w-full text-left">
          {describeFailure(initialError)}
        </AuthNotice>
        <Button asChild size="lg" className="w-full">
          <Link to="/login">Request a new sign-in link</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
