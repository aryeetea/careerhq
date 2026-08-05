import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Mail, Pencil } from "lucide-react";
import { AuthLayout } from "@/pages/auth/AuthLayout";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { magicLinkRequestSchema, signInSchema, type MagicLinkRequestValues, type SignInValues } from "@/lib/validation";
import { requestSignInMagicLink, signIn } from "@/services/auth";
import { useToast } from "@/components/shared/toast";

const RESEND_COOLDOWN_SECONDS = 45;

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();
  const [authMethod, setAuthMethod] = React.useState<"password" | "magic-link">("password");
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = React.useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = React.useState(0);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [isResending, setIsResending] = React.useState(false);
  const params = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const redirectTo = params.get("next") ?? (location.state as { from?: string } | null)?.from ?? "/app";
  const passwordForm = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });
  const magicLinkForm = useForm<MagicLinkRequestValues>({ resolver: zodResolver(magicLinkRequestSchema) });

  React.useEffect(() => {
    if (!resendAvailableAt) {
      setSecondsRemaining(0);
      return;
    }

    const tick = () => {
      const next = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
      setSecondsRemaining(next);
      if (next === 0) setResendAvailableAt(null);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  function startResendCooldown() {
    setResendAvailableAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
  }

  function changeEmail() {
    setSentTo(null);
    setResendAvailableAt(null);
    setSecondsRemaining(0);
    setRequestError(null);
    setIsResending(false);
    magicLinkForm.reset();
  }

  async function onPasswordSubmit(values: SignInValues) {
    setPasswordError(null);
    try {
      await signIn(values.email, values.password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't sign in. Check your details and try again.";
      setPasswordError(message);
      push(message, "error");
    }
  }

  async function sendLink(values: MagicLinkRequestValues) {
    setRequestError(null);
    try {
      await requestSignInMagicLink(values.email, redirectTo);
      setSentTo(values.email);
      startResendCooldown();
      push("Your sign-in link is on the way.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't send a sign-in link right now.";
      setRequestError(message);
      push(message, "error");
    }
  }

  async function resendLink() {
    if (!sentTo || isResending) return;
    if (secondsRemaining > 0) {
      push(`Give it ${secondsRemaining}s before requesting another link.`, "info");
      return;
    }

    setRequestError(null);
    setIsResending(true);
    try {
      await requestSignInMagicLink(sentTo, redirectTo);
      startResendCooldown();
      push("A fresh sign-in link is on the way.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't resend the link right now.";
      setRequestError(message);
      push(message, "error");
    } finally {
      setIsResending(false);
    }
  }

  const passwordBusy = passwordForm.formState.isSubmitting;
  const requestBusy = magicLinkForm.formState.isSubmitting;
  const resendDisabled = secondsRemaining > 0 || isResending;

  return (
    <AuthLayout title="Welcome back" subtitle="Take a breath. Let's see where things stand.">
      <Tabs
        value={authMethod}
        onValueChange={(value) => {
          setAuthMethod(value as "password" | "magic-link");
          setPasswordError(null);
          setRequestError(null);
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password" aria-controls="signin-password-panel">
            Password
          </TabsTrigger>
          <TabsTrigger value="magic-link" aria-controls="signin-magic-link-panel">
            Email link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="password" id="signin-password-panel">
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="grid gap-4" noValidate aria-busy={passwordBusy}>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...passwordForm.register("email")}
                aria-invalid={!!passwordForm.formState.errors.email}
                aria-describedby={passwordForm.formState.errors.email ? "signin-email-error" : undefined}
              />
              {passwordForm.formState.errors.email && (
                <p id="signin-email-error" className="text-xs font-medium text-destructive">
                  {passwordForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password">Password</Label>
                <Link
                  to={params.get("next") ? `/forgot-password?next=${encodeURIComponent(params.get("next") as string)}` : "/forgot-password"}
                  className="rounded-full px-1.5 py-1 text-sm font-medium text-primary/90 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...passwordForm.register("password")}
                aria-invalid={!!passwordForm.formState.errors.password}
                aria-describedby={passwordForm.formState.errors.password ? "signin-password-error" : undefined}
              />
              {passwordForm.formState.errors.password && (
                <p id="signin-password-error" className="text-xs font-medium text-destructive">
                  {passwordForm.formState.errors.password.message}
                </p>
              )}
            </div>
            {passwordError && <AuthNotice variant="error">{passwordError}</AuthNotice>}
            <Button type="submit" size="lg" disabled={passwordBusy} className="mt-1" aria-busy={passwordBusy}>
              {passwordBusy ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="magic-link" id="signin-magic-link-panel">
          {sentTo ? (
            <div className="grid gap-4">
              <div className="flex flex-col items-center gap-3 py-1 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <AuthNotice variant="success" className="w-full text-left">
                  We sent a secure sign-in link to <span className="font-semibold text-foreground">{sentTo}</span>. Open it on
                  this device to continue.
                </AuthNotice>
                <AuthNotice variant="info" className="w-full text-left">
                  Links usually arrive within a minute. Check spam or promotions if it's missing.
                  {secondsRemaining > 0 ? ` You can request another in ${secondsRemaining}s.` : " You can resend if it still hasn't arrived."}
                </AuthNotice>
              </div>

              {requestError && <AuthNotice variant="error">{requestError}</AuthNotice>}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="ghost" size="sm" onClick={resendLink} disabled={resendDisabled} className="justify-start px-2">
                  {isResending ? (
                    <>
                      <LoaderCircle className="animate-spin" />
                      Sending a fresh link…
                    </>
                  ) : secondsRemaining > 0 ? (
                    `Resend link in ${secondsRemaining}s`
                  ) : (
                    "Resend link"
                  )}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={changeEmail} className="justify-start sm:justify-center">
                  <Pencil className="h-4 w-4" />
                  Change email
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={magicLinkForm.handleSubmit(sendLink)} className="grid gap-4" noValidate aria-busy={requestBusy}>
              <div className="grid gap-1.5">
                <Label htmlFor="magic-link-email">Email</Label>
                <Input
                  id="magic-link-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...magicLinkForm.register("email")}
                  aria-invalid={!!magicLinkForm.formState.errors.email || !!requestError}
                  aria-describedby={[
                    "signin-magic-link-help",
                    magicLinkForm.formState.errors.email ? "signin-magic-link-email-error" : null,
                    requestError ? "signin-magic-link-request-error" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
                {magicLinkForm.formState.errors.email && (
                  <p id="signin-magic-link-email-error" className="text-xs font-medium text-destructive">
                    {magicLinkForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <p id="signin-magic-link-help" className="text-sm leading-6 text-foreground/72">
                We&apos;ll email you a secure link — no password needed. Just open it on this device to sign in.
              </p>
              {requestError && (
                <AuthNotice variant="error">
                  <span id="signin-magic-link-request-error">{requestError}</span>
                </AuthNotice>
              )}
              <Button type="submit" size="lg" disabled={requestBusy} className="mt-1" aria-busy={requestBusy}>
                {requestBusy ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    Sending link…
                  </>
                ) : (
                  "Email me a sign-in link"
                )}
              </Button>
            </form>
          )}
        </TabsContent>
      </Tabs>

      <p className="mt-5 text-center text-sm leading-6 text-foreground/68">
        New to Bloom?{" "}
        <Link
          to={params.get("next") ? `/signup?next=${encodeURIComponent(params.get("next") as string)}` : "/signup"}
          className="rounded-full px-1.5 py-1 font-semibold text-primary/90 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
