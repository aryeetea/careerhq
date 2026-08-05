import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { AuthLayout } from "@/pages/auth/AuthLayout";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  otpRequestSchema,
  otpVerificationSchema,
  signInSchema,
  type OtpRequestValues,
  type OtpVerificationValues,
  type SignInValues,
} from "@/lib/validation";
import { requestSignInOtp, signIn, verifyEmailOtp } from "@/services/auth";
import { useToast } from "@/components/shared/toast";

const OTP_RESEND_SECONDS = 45;

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();
  const [authMethod, setAuthMethod] = React.useState<"password" | "otp">("password");
  const [otpEmail, setOtpEmail] = React.useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = React.useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = React.useState(0);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [requestStatus, setRequestStatus] = React.useState<string | null>(null);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [isResending, setIsResending] = React.useState(false);
  const params = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const redirectTo = params.get("next") ?? (location.state as { from?: string } | null)?.from ?? "/app";
  const passwordForm = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });
  const otpRequestForm = useForm<OtpRequestValues>({ resolver: zodResolver(otpRequestSchema) });
  const otpVerifyForm = useForm<OtpVerificationValues>({ resolver: zodResolver(otpVerificationSchema) });

  React.useEffect(() => {
    if (!resendAvailableAt) {
      setSecondsRemaining(0);
      return;
    }

    const tick = () => {
      const next = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
      setSecondsRemaining(next);
      if (next === 0) {
        setResendAvailableAt(null);
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  React.useEffect(() => {
    if (!otpEmail) return;
    const focusTimer = window.setTimeout(() => otpVerifyForm.setFocus("token"), 20);
    return () => window.clearTimeout(focusTimer);
  }, [otpEmail, otpVerifyForm]);

  function startResendCooldown() {
    setResendAvailableAt(Date.now() + OTP_RESEND_SECONDS * 1000);
  }

  function resetOtpFlow() {
    setOtpEmail(null);
    setResendAvailableAt(null);
    setSecondsRemaining(0);
    setRequestStatus(null);
    setRequestError(null);
    setVerifyError(null);
    setIsResending(false);
    otpRequestForm.reset();
    otpVerifyForm.reset();
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

  async function sendCode(values: OtpRequestValues) {
    setRequestError(null);
    setVerifyError(null);

    try {
      await requestSignInOtp(values.email);
      setOtpEmail(values.email);
      setRequestStatus(`Your 6-digit sign-in code is on the way to ${values.email}.`);
      otpVerifyForm.reset();
      startResendCooldown();
      push("Your 6-digit sign-in code is on the way.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't send a sign-in code right now.";
      setRequestError(message);
      push(message, "error");
    }
  }

  async function verifyCode(values: OtpVerificationValues) {
    if (!otpEmail) return;

    setVerifyError(null);

    try {
      await verifyEmailOtp(otpEmail, values.token);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "That code didn't work. Request a fresh one and try again.";
      setVerifyError(message);
      push(message, "error");
    }
  }

  async function resendCode() {
    if (!otpEmail || isResending) return;
    if (secondsRemaining > 0) {
      push(`Give it ${secondsRemaining}s before asking for another code.`, "info");
      return;
    }

    setRequestError(null);
    setVerifyError(null);
    setIsResending(true);

    try {
      await requestSignInOtp(otpEmail);
      otpVerifyForm.reset();
      setRequestStatus(`A fresh 6-digit sign-in code is on the way to ${otpEmail}.`);
      startResendCooldown();
      push("A fresh 6-digit code is on the way.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't resend the code right now.";
      setRequestError(message);
      push(message, "error");
    } finally {
      setIsResending(false);
    }
  }

  const passwordBusy = passwordForm.formState.isSubmitting;
  const requestBusy = otpRequestForm.formState.isSubmitting;
  const verifyBusy = otpVerifyForm.formState.isSubmitting;
  const resendDisabled = secondsRemaining > 0 || isResending || verifyBusy;

  return (
    <AuthLayout title="Welcome back" subtitle="Take a breath. Let's see where things stand.">
      <Tabs
        value={authMethod}
        onValueChange={(value) => {
          setAuthMethod(value as "password" | "otp");
          setPasswordError(null);
          setRequestError(null);
          setVerifyError(null);
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password" aria-controls="signin-password-panel">
            Password
          </TabsTrigger>
          <TabsTrigger value="otp" aria-controls="signin-otp-panel">
            Email code
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

        <TabsContent value="otp" id="signin-otp-panel">
          {otpEmail ? (
            <div className="grid gap-4">
              {requestStatus && (
                <AuthNotice variant="success">
                  <span>
                    {requestStatus} Use the same email address on this screen so Bloom can finish signing you in safely.
                  </span>
                </AuthNotice>
              )}
              <AuthNotice variant="info">
                <span>
                  Codes usually arrive within a minute. Check spam or promotions if it is missing.
                  {secondsRemaining > 0 ? ` You can request another code in ${secondsRemaining}s.` : " You can resend if it still hasn't arrived."}
                </span>
              </AuthNotice>

              <form onSubmit={otpVerifyForm.handleSubmit(verifyCode)} className="grid gap-4" noValidate aria-busy={verifyBusy}>
                <div className="grid gap-1.5">
                  <Label htmlFor="otp">6-digit code</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={6}
                    {...otpVerifyForm.register("token")}
                    aria-invalid={!!otpVerifyForm.formState.errors.token || !!verifyError}
                    aria-describedby={[
                      "signin-otp-help",
                      otpVerifyForm.formState.errors.token ? "signin-otp-error" : null,
                      verifyError ? "signin-otp-request-error" : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                  <p id="signin-otp-help" className="text-xs font-medium text-foreground/65">
                    Enter numbers only. If the code has expired, ask for a fresh one below.
                  </p>
                  {otpVerifyForm.formState.errors.token && (
                    <p id="signin-otp-error" className="text-xs font-medium text-destructive">
                      {otpVerifyForm.formState.errors.token.message}
                    </p>
                  )}
                </div>
                {verifyError && (
                  <AuthNotice variant="error" className="animate-slide-up motion-reduce:animate-none">
                    <span id="signin-otp-request-error">{verifyError}</span>
                  </AuthNotice>
                )}
                <Button type="submit" size="lg" disabled={verifyBusy || isResending} className="mt-1" aria-busy={verifyBusy}>
                  {verifyBusy ? (
                    <>
                      <LoaderCircle className="animate-spin" />
                      Checking code…
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </form>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="ghost" size="sm" onClick={resendCode} disabled={resendDisabled} className="justify-start px-2">
                  {isResending ? (
                    <>
                      <LoaderCircle className="animate-spin" />
                      Sending a fresh code…
                    </>
                  ) : secondsRemaining > 0 ? (
                    `Resend code in ${secondsRemaining}s`
                  ) : (
                    "Resend code"
                  )}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={resetOtpFlow} className="justify-start sm:justify-center">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={otpRequestForm.handleSubmit(sendCode)} className="grid gap-4" noValidate aria-busy={requestBusy}>
              <div className="grid gap-1.5">
                <Label htmlFor="otp-email">Email</Label>
                <Input
                  id="otp-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...otpRequestForm.register("email")}
                  aria-invalid={!!otpRequestForm.formState.errors.email || !!requestError}
                  aria-describedby={[
                    "signin-otp-request-help",
                    otpRequestForm.formState.errors.email ? "signin-otp-email-error" : null,
                    requestError ? "signin-otp-request-inline-error" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
                {otpRequestForm.formState.errors.email && (
                  <p id="signin-otp-email-error" className="text-xs font-medium text-destructive">
                    {otpRequestForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <p id="signin-otp-request-help" className="text-sm leading-6 text-foreground/72">
                We&apos;ll send a 6-digit sign-in code to your email. No password entry needed on the next step.
              </p>
              <AuthNotice variant="info">
                To protect your inbox, Bloom spaces out code emails for a moment if you tap repeatedly.
              </AuthNotice>
              {requestError && (
                <AuthNotice variant="error">
                  <span id="signin-otp-request-inline-error">{requestError}</span>
                </AuthNotice>
              )}
              <Button type="submit" size="lg" disabled={requestBusy} className="mt-1" aria-busy={requestBusy}>
                {requestBusy ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    Sending code…
                  </>
                ) : (
                  "Email me a code"
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
