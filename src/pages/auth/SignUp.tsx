import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LoaderCircle, Mail } from "lucide-react";
import { AuthLayout } from "@/pages/auth/AuthLayout";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  otpVerificationSchema,
  signUpOtpRequestSchema,
  signUpSchema,
  type OtpVerificationValues,
  type SignUpOtpRequestValues,
  type SignUpValues,
} from "@/lib/validation";
import { requestSignUpOtp, resendVerificationEmail, signUp, verifyEmailOtp } from "@/services/auth";
import { useToast } from "@/components/shared/toast";

interface PendingOtpSignup {
  email: string;
  displayName: string;
}

const OTP_RESEND_SECONDS = 45;

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();
  const params = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const redirectTo = params.get("next") ?? "/onboarding";
  const [authMethod, setAuthMethod] = React.useState<"password" | "otp">("password");
  const [sent, setSent] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [resendVerificationState, setResendVerificationState] = React.useState<{
    error: string | null;
    loading: boolean;
    success: string | null;
  }>({ error: null, loading: false, success: null });
  const [otpSignup, setOtpSignup] = React.useState<PendingOtpSignup | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = React.useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = React.useState(0);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [requestStatus, setRequestStatus] = React.useState<string | null>(null);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [isResending, setIsResending] = React.useState(false);
  const passwordForm = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });
  const otpRequestForm = useForm<SignUpOtpRequestValues>({ resolver: zodResolver(signUpOtpRequestSchema) });
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
    if (!otpSignup) return;
    const focusTimer = window.setTimeout(() => otpVerifyForm.setFocus("token"), 20);
    return () => window.clearTimeout(focusTimer);
  }, [otpSignup, otpVerifyForm]);

  function startResendCooldown() {
    setResendAvailableAt(Date.now() + OTP_RESEND_SECONDS * 1000);
  }

  function resetOtpFlow() {
    setOtpSignup(null);
    setResendAvailableAt(null);
    setSecondsRemaining(0);
    setRequestStatus(null);
    setRequestError(null);
    setVerifyError(null);
    setIsResending(false);
    otpRequestForm.reset();
    otpVerifyForm.reset();
  }

  async function onPasswordSubmit(values: SignUpValues) {
    setPasswordError(null);
    setResendVerificationState({ error: null, loading: false, success: null });

    try {
      const result = await signUp(values.email, values.password, values.displayName);
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

  async function sendCode(values: SignUpOtpRequestValues) {
    setRequestError(null);
    setVerifyError(null);

    try {
      await requestSignUpOtp(values.email, values.displayName);
      setOtpSignup(values);
      setRequestStatus(`Your 6-digit sign-up code is on the way to ${values.email}.`);
      otpVerifyForm.reset();
      startResendCooldown();
      push("Your 6-digit sign-up code is on the way.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't send a sign-up code right now.";
      setRequestError(message);
      push(message, "error");
    }
  }

  async function verifyCode(values: OtpVerificationValues) {
    if (!otpSignup) return;

    setVerifyError(null);

    try {
      await verifyEmailOtp(otpSignup.email, values.token);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "That code didn't work. Request a fresh one and try again.";
      setVerifyError(message);
      push(message, "error");
    }
  }

  async function resendCode() {
    if (!otpSignup || isResending) return;
    if (secondsRemaining > 0) {
      push(`Give it ${secondsRemaining}s before asking for another code.`, "info");
      return;
    }

    setRequestError(null);
    setVerifyError(null);
    setIsResending(true);

    try {
      await requestSignUpOtp(otpSignup.email, otpSignup.displayName);
      otpVerifyForm.reset();
      setRequestStatus(`A fresh 6-digit sign-up code is on the way to ${otpSignup.email}.`);
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
  const requestBusy = otpRequestForm.formState.isSubmitting;
  const verifyBusy = otpVerifyForm.formState.isSubmitting;
  const resendDisabled = secondsRemaining > 0 || isResending || verifyBusy;

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
              <Link to="/login">Back to sign in</Link>
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
          setAuthMethod(value as "password" | "otp");
          setPasswordError(null);
          setRequestError(null);
          setVerifyError(null);
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password" aria-controls="signup-password-panel">
            Password
          </TabsTrigger>
          <TabsTrigger value="otp" aria-controls="signup-otp-panel">
            Email code
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

        <TabsContent value="otp" id="signup-otp-panel">
          {otpSignup ? (
            <div className="grid gap-4">
              {requestStatus && (
                <AuthNotice variant="success">
                  <span>
                    {requestStatus} Once you confirm it, Bloom will finish creating your account and take you into onboarding.
                  </span>
                </AuthNotice>
              )}
              <AuthNotice variant="info">
                <span>
                  We&apos;ll keep your spot. Check spam or promotions first if the email feels slow.
                  {secondsRemaining > 0 ? ` You can resend in ${secondsRemaining}s.` : " You can resend below if needed."}
                </span>
              </AuthNotice>

              <form onSubmit={otpVerifyForm.handleSubmit(verifyCode)} className="grid gap-4" noValidate aria-busy={verifyBusy}>
                <div className="grid gap-1.5">
                  <Label htmlFor="signup-otp">6-digit code</Label>
                  <Input
                    id="signup-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={6}
                    {...otpVerifyForm.register("token")}
                    aria-invalid={!!otpVerifyForm.formState.errors.token || !!verifyError}
                    aria-describedby={[
                      "signup-otp-help",
                      otpVerifyForm.formState.errors.token ? "signup-otp-error" : null,
                      verifyError ? "signup-otp-request-error" : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                  <p id="signup-otp-help" className="text-xs font-medium text-foreground/65">
                    Use the latest 6-digit code from your email. Older codes can expire once you request a new one.
                  </p>
                  {otpVerifyForm.formState.errors.token && (
                    <p id="signup-otp-error" className="text-xs font-medium text-destructive">
                      {otpVerifyForm.formState.errors.token.message}
                    </p>
                  )}
                </div>
                {verifyError && (
                  <AuthNotice variant="error" className="animate-slide-up motion-reduce:animate-none">
                    <span id="signup-otp-request-error">{verifyError}</span>
                  </AuthNotice>
                )}
                <Button type="submit" size="lg" disabled={verifyBusy || isResending} className="mt-1" aria-busy={verifyBusy}>
                  {verifyBusy ? (
                    <>
                      <LoaderCircle className="animate-spin" />
                      Checking code…
                    </>
                  ) : (
                    "Create account"
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
                <Label htmlFor="otp-display-name">What should we call you?</Label>
                <Input
                  id="otp-display-name"
                  autoComplete="name"
                  placeholder="Jane Doe"
                  {...otpRequestForm.register("displayName")}
                  aria-invalid={!!otpRequestForm.formState.errors.displayName}
                  aria-describedby={otpRequestForm.formState.errors.displayName ? "otp-display-name-error" : undefined}
                />
                {otpRequestForm.formState.errors.displayName && (
                  <p id="otp-display-name-error" className="text-xs font-medium text-destructive">
                    {otpRequestForm.formState.errors.displayName.message}
                  </p>
                )}
              </div>
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
                    "signup-otp-request-help",
                    otpRequestForm.formState.errors.email ? "otp-email-error" : null,
                    requestError ? "signup-otp-request-inline-error" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
                {otpRequestForm.formState.errors.email && (
                  <p id="otp-email-error" className="text-xs font-medium text-destructive">
                    {otpRequestForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <p id="signup-otp-request-help" className="text-sm leading-6 text-foreground/72">
                We&apos;ll send a 6-digit code so you can create your account without setting a password first.
              </p>
              <AuthNotice variant="info">
                For a smoother experience, Bloom paces repeated code requests so one impatient tap does not flood your inbox.
              </AuthNotice>
              {requestError && (
                <AuthNotice variant="error">
                  <span id="signup-otp-request-inline-error">{requestError}</span>
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
