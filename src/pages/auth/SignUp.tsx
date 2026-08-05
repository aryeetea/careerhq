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
import {
  signUpMagicLinkRequestSchema,
  signUpSchema,
  type SignUpMagicLinkRequestValues,
  type SignUpValues,
} from "@/lib/validation";
import { requestSignUpMagicLink, resendVerificationEmail, signUp } from "@/services/auth";
import { useToast } from "@/components/shared/toast";

interface PendingMagicLinkSignup {
  email: string;
  displayName: string;
}

const RESEND_COOLDOWN_SECONDS = 45;

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();
  const params = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const redirectTo = params.get("next") ?? "/onboarding";
  const [authMethod, setAuthMethod] = React.useState<"password" | "magic-link">("password");
  const [sent, setSent] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [resendVerificationState, setResendVerificationState] = React.useState<{
    error: string | null;
    loading: boolean;
    success: string | null;
  }>({ error: null, loading: false, success: null });
  const [pendingSignup, setPendingSignup] = React.useState<PendingMagicLinkSignup | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = React.useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = React.useState(0);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [isResending, setIsResending] = React.useState(false);
  const passwordForm = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });
  const magicLinkForm = useForm<SignUpMagicLinkRequestValues>({ resolver: zodResolver(signUpMagicLinkRequestSchema) });

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
    setPendingSignup(null);
    setResendAvailableAt(null);
    setSecondsRemaining(0);
    setRequestError(null);
    setIsResending(false);
    magicLinkForm.reset();
  }

  async function onPasswordSubmit(values: SignUpValues) {
    setPasswordError(null);
    setResendVerificationState({ error: null, loading: false, success: null });

    try {
      const result = await signUp(
        values.email,
        values.password,
        values.displayName,
        `/login?next=${encodeURIComponent(redirectTo)}`
      );
      if (result.session) {
        navigate(redirectTo, { replace: true });
        return;
      }
      setSent(values.email);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't create your account. Try again.";
      setPasswordError(message);
      push(message, "error");
    }
  }

  async function sendLink(values: SignUpMagicLinkRequestValues) {
    setRequestError(null);
    try {
      await requestSignUpMagicLink(values.email, values.displayName, redirectTo);
      setPendingSignup(values);
      startResendCooldown();
      push("Your sign-in link is on the way.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't send a sign-in link right now.";
      setRequestError(message);
      push(message, "error");
    }
  }

  async function resendLink() {
    if (!pendingSignup || isResending) return;
    if (secondsRemaining > 0) {
      push(`Give it ${secondsRemaining}s before requesting another link.`, "info");
      return;
    }

    setRequestError(null);
    setIsResending(true);
    try {
      await requestSignUpMagicLink(pendingSignup.email, pendingSignup.displayName, redirectTo);
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

  async function onResendVerificationEmail() {
    if (!sent || resendVerificationState.loading) return;

    setResendVerificationState({ error: null, loading: true, success: null });

    try {
      await resendVerificationEmail(sent);
      setResendVerificationState({
        error: null,
        loading: false,
        success: `A fresh verification email is on the way to ${sent}.`,
      });
      push("Verification email resent.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't resend the verification email right now.";
      setResendVerificationState({ error: message, loading: false, success: null });
      push(message, "error");
    }
  }

  const passwordBusy = passwordForm.formState.isSubmitting;
  const requestBusy = magicLinkForm.formState.isSubmitting;
  const resendDisabled = secondsRemaining > 0 || isResending;

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle="One more step before you're in.">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <AuthNotice variant="success" className="w-full text-left">
            We sent a verification link to <span className="font-semibold text-foreground">{sent}</span>. Open it, then come back
            here to sign in.
          </AuthNotice>
          <AuthNotice variant="info" className="w-full text-left">
            If you do not see it, check spam or promotions first. Verification links can take a minute to arrive.
          </AuthNotice>
          {resendVerificationState.success && <AuthNotice variant="success" className="w-full text-left">{resendVerificationState.success}</AuthNotice>}
          {resendVerificationState.error && <AuthNotice variant="error" className="w-full text-left">{resendVerificationState.error}</AuthNotice>}
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onResendVerificationEmail}
              disabled={resendVerificationState.loading}
            >
              {resendVerificationState.loading ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  Resending…
                </>
              ) : (
                "Resend verification email"
              )}
            </Button>
            <Button asChild className="flex-1">
              <Link to={params.get("next") ? `/login?next=${encodeURIComponent(params.get("next") as string)}` : "/login"}>Back to sign in</Link>
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Start your search, gently" subtitle="A calm home base for everything job-search related.">
      <Tabs
        value={authMethod}
        onValueChange={(value) => {
          setAuthMethod(value as "password" | "magic-link");
          setPasswordError(null);
          setRequestError(null);
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password" aria-controls="signup-password-panel">
            Password
          </TabsTrigger>
          <TabsTrigger value="magic-link" aria-controls="signup-magic-link-panel">
            Email link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="password" id="signup-password-panel">
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="grid gap-4" noValidate aria-busy={passwordBusy}>
            <div className="grid gap-1.5">
              <Label htmlFor="displayName">What should we call you?</Label>
              <Input
                id="displayName"
                autoComplete="name"
                placeholder="Jane Doe"
                {...passwordForm.register("displayName")}
                aria-invalid={!!passwordForm.formState.errors.displayName}
                aria-describedby={passwordForm.formState.errors.displayName ? "signup-display-name-error" : undefined}
              />
              {passwordForm.formState.errors.displayName && (
                <p id="signup-display-name-error" className="text-xs font-medium text-destructive">
                  {passwordForm.formState.errors.displayName.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...passwordForm.register("email")}
                aria-invalid={!!passwordForm.formState.errors.email}
                aria-describedby={passwordForm.formState.errors.email ? "signup-email-error" : undefined}
              />
              {passwordForm.formState.errors.email && (
                <p id="signup-email-error" className="text-xs font-medium text-destructive">
                  {passwordForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("password")}
                aria-invalid={!!passwordForm.formState.errors.password}
                aria-describedby={passwordForm.formState.errors.password ? "signup-password-error" : undefined}
              />
              {passwordForm.formState.errors.password && (
                <p id="signup-password-error" className="text-xs font-medium text-destructive">
                  {passwordForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("confirmPassword")}
                aria-invalid={!!passwordForm.formState.errors.confirmPassword}
                aria-describedby={passwordForm.formState.errors.confirmPassword ? "signup-confirm-password-error" : undefined}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p id="signup-confirm-password-error" className="text-xs font-medium text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            {passwordError && <AuthNotice variant="error">{passwordError}</AuthNotice>}
            <Button type="submit" size="lg" disabled={passwordBusy} className="mt-1" aria-busy={passwordBusy}>
              {passwordBusy ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  Creating your space…
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="magic-link" id="signup-magic-link-panel">
          {pendingSignup ? (
            <div className="grid gap-4">
              <div className="flex flex-col items-center gap-3 py-1 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <AuthNotice variant="success" className="w-full text-left">
                  We sent a secure sign-in link to <span className="font-semibold text-foreground">{pendingSignup.email}</span>.
                  Open it on this device to continue.
                </AuthNotice>
                <AuthNotice variant="info" className="w-full text-left">
                  Once you open it, Bloom will finish creating your account and take you into onboarding.
                  {secondsRemaining > 0 ? ` You can request another link in ${secondsRemaining}s.` : " You can resend below if needed."}
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
                <Label htmlFor="magic-link-display-name">What should we call you?</Label>
                <Input
                  id="magic-link-display-name"
                  autoComplete="name"
                  placeholder="Jane Doe"
                  {...magicLinkForm.register("displayName")}
                  aria-invalid={!!magicLinkForm.formState.errors.displayName}
                  aria-describedby={magicLinkForm.formState.errors.displayName ? "magic-link-display-name-error" : undefined}
                />
                {magicLinkForm.formState.errors.displayName && (
                  <p id="magic-link-display-name-error" className="text-xs font-medium text-destructive">
                    {magicLinkForm.formState.errors.displayName.message}
                  </p>
                )}
              </div>
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
                    "signup-magic-link-help",
                    magicLinkForm.formState.errors.email ? "magic-link-email-error" : null,
                    requestError ? "signup-magic-link-request-error" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
                {magicLinkForm.formState.errors.email && (
                  <p id="magic-link-email-error" className="text-xs font-medium text-destructive">
                    {magicLinkForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <p id="signup-magic-link-help" className="text-sm leading-6 text-foreground/72">
                We&apos;ll email you a secure link to create your account — no password needed.
              </p>
              {requestError && (
                <AuthNotice variant="error">
                  <span id="signup-magic-link-request-error">{requestError}</span>
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
        Already have an account?{" "}
        <Link
          to={params.get("next") ? `/login?next=${encodeURIComponent(params.get("next") as string)}` : "/login"}
          className="rounded-full px-1.5 py-1 font-semibold text-primary/90 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
