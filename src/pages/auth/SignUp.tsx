import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Mail } from "lucide-react";
import { AuthLayout } from "@/pages/auth/AuthLayout";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { PasswordStrengthHint } from "@/components/auth/PasswordStrengthHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { signUpSchema, type SignUpValues } from "@/lib/validation";
import { resendVerificationEmail, signUp } from "@/services/auth";
import { useToast } from "@/components/shared/toast";

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();
  const params = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const redirectTo = params.get("next") ?? "/app";
  const [sent, setSent] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [resendState, setResendState] = React.useState<{ error: string | null; loading: boolean; success: string | null }>({
    error: null,
    loading: false,
    success: null,
  });
  // Belt-and-braces guard against a double Enter/click firing two submits
  // before the disabled state on the button has a chance to re-render.
  const submittingRef = React.useRef(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });
  const password = watch("password") ?? "";

  async function onSubmit(values: SignUpValues) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);
    setResendState({ error: null, loading: false, success: null });

    try {
      const result = await signUp(values.email, values.password, values.displayName, redirectTo);
      if (result.session) {
        // Email confirmation is off — signUp already returned a live session.
        navigate(redirectTo, { replace: true });
        return;
      }
      setSent(values.email);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't create your account. Try again.";
      setFormError(message);
      push(message, "error");
    } finally {
      submittingRef.current = false;
    }
  }

  async function onResendVerificationEmail() {
    if (!sent || resendState.loading) return;

    setResendState({ error: null, loading: true, success: null });
    try {
      await resendVerificationEmail(sent);
      setResendState({ error: null, loading: false, success: `A fresh verification email is on the way to ${sent}.` });
      push("Verification email resent.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't resend the verification email right now.";
      setResendState({ error: message, loading: false, success: null });
      push(message, "error");
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle="One more step before you're in.">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <AuthNotice variant="success" className="w-full text-left">
            We sent a verification link to <span className="font-semibold text-foreground">{sent}</span>. Open it to confirm your
            email, then come back here to sign in.
          </AuthNotice>
          <AuthNotice variant="info" className="w-full text-left">
            If you don't see it, check spam or promotions first. Verification links can take a minute to arrive.
          </AuthNotice>
          {resendState.success && (
            <AuthNotice variant="success" className="w-full text-left">
              {resendState.success}
            </AuthNotice>
          )}
          {resendState.error && (
            <AuthNotice variant="error" className="w-full text-left">
              {resendState.error}
            </AuthNotice>
          )}
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onResendVerificationEmail}
              disabled={resendState.loading}
            >
              {resendState.loading ? (
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
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate aria-busy={isSubmitting}>
        <div className="grid gap-1.5">
          <Label htmlFor="displayName">What should we call you?</Label>
          <Input
            id="displayName"
            autoComplete="name"
            placeholder="Jane Doe"
            {...register("displayName")}
            aria-invalid={!!errors.displayName}
            aria-describedby={errors.displayName ? "signup-display-name-error" : undefined}
          />
          {errors.displayName && (
            <p id="signup-display-name-error" className="text-xs font-medium text-destructive">
              {errors.displayName.message}
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
            {...register("email")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "signup-email-error" : undefined}
          />
          {errors.email && (
            <p id="signup-email-error" className="text-xs font-medium text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            {...register("password")}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "signup-password-error" : "signup-password-hint"}
          />
          {errors.password ? (
            <p id="signup-password-error" className="text-xs font-medium text-destructive">
              {errors.password.message}
            </p>
          ) : (
            <div id="signup-password-hint">
              <PasswordStrengthHint password={password} />
            </div>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            {...register("confirmPassword")}
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? "signup-confirm-password-error" : undefined}
          />
          {errors.confirmPassword && (
            <p id="signup-confirm-password-error" className="text-xs font-medium text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
        {formError && <AuthNotice variant="error">{formError}</AuthNotice>}
        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1" aria-busy={isSubmitting}>
          {isSubmitting ? (
            <>
              <LoaderCircle className="animate-spin" />
              Creating your space…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

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
