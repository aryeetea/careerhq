import * as React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout } from "@/pages/auth/AuthLayout";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  forgotPasswordSchema,
  resetPasswordWithOtpSchema,
  type ForgotPasswordValues,
  type ResetPasswordWithOtpValues,
} from "@/lib/validation";
import { requestPasswordReset, resetPasswordWithOtp } from "@/services/auth";
import { useToast } from "@/components/shared/toast";
import { Mail } from "lucide-react";

// Two steps, both on this one page: request a code, then enter it (with a
// new password) to finish. Deliberately a typed code rather than an emailed
// link — links are single-use and get silently burned if an email
// provider's security scanner prefetches them before the user ever clicks,
// which reads to the user as "the reset link didn't work" with no way to
// tell why. A code the user types by hand is never fetched by anything but
// the user. See resetPasswordWithOtp in services/auth.ts.
//
// This relies on the "Reset Password" email template (Supabase dashboard →
// Authentication → Email Templates) including {{ .Token }}. If it only has
// {{ .ConfirmationURL }}, the email won't contain a code to enter here —
// the link-based flow at /reset-password (reached via /auth/callback)
// still exists as a fallback either way.
export default function ForgotPassword() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [sentEmail, setSentEmail] = React.useState<string | null>(null);

  const requestForm = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });
  const codeForm = useForm<ResetPasswordWithOtpValues>({ resolver: zodResolver(resetPasswordWithOtpSchema) });

  async function onRequestSubmit(values: ForgotPasswordValues) {
    try {
      await requestPasswordReset(values.email);
      setSentEmail(values.email);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't send that code. Try again in a moment.", "error");
    }
  }

  async function onCodeSubmit(values: ResetPasswordWithOtpValues) {
    if (!sentEmail) return;
    try {
      await resetPasswordWithOtp(sentEmail, values.token, values.password);
      push("Password updated. Welcome back.", "success");
      navigate("/app", { replace: true });
    } catch (err) {
      push(err instanceof Error ? err.message : "That code didn't work. Request a new one and try again.", "error");
    }
  }

  async function resendCode() {
    if (!sentEmail) return;
    try {
      await requestPasswordReset(sentEmail);
      push("Sent a new code — the old one no longer works.", "success");
      codeForm.reset({ token: "", password: "", confirmPassword: "" });
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't send that code. Try again in a moment.", "error");
    }
  }

  if (sentEmail) {
    return (
      <AuthLayout title="Enter your code" subtitle="Check your inbox — this only takes a second.">
        <div className="grid gap-4">
          <AuthNotice variant="info">
            <div className="flex items-start gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                If an account exists for <span className="font-medium text-foreground">{sentEmail}</span>, we sent it a 6-digit
                code. Enter it below along with your new password.
              </span>
            </div>
          </AuthNotice>

          <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="grid gap-4" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="token">6-digit code *</Label>
              <Input
                id="token"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                required
                aria-required="true"
                {...codeForm.register("token")}
                aria-invalid={!!codeForm.formState.errors.token}
              />
              {codeForm.formState.errors.token && (
                <p className="text-xs text-destructive">{codeForm.formState.errors.token.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">New password *</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                required
                aria-required="true"
                {...codeForm.register("password")}
                aria-invalid={!!codeForm.formState.errors.password}
              />
              {codeForm.formState.errors.password && (
                <p className="text-xs text-destructive">{codeForm.formState.errors.password.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirmPassword">Confirm password *</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                required
                aria-required="true"
                {...codeForm.register("confirmPassword")}
                aria-invalid={!!codeForm.formState.errors.confirmPassword}
              />
              {codeForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{codeForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" size="lg" disabled={codeForm.formState.isSubmitting} className="mt-1">
              {codeForm.formState.isSubmitting ? "Updating…" : "Update password"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Didn't get a code, or it expired?{" "}
            <button type="button" onClick={resendCode} className="font-medium text-primary hover:underline">
              Send a new one
            </button>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            <button type="button" onClick={() => setSentEmail(null)} className="font-medium text-primary hover:underline">
              Use a different email
            </button>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a code to choose a new one.">
      <form onSubmit={requestForm.handleSubmit(onRequestSubmit)} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            aria-required="true"
            {...requestForm.register("email")}
            aria-invalid={!!requestForm.formState.errors.email}
          />
          {requestForm.formState.errors.email && (
            <p className="text-xs text-destructive">{requestForm.formState.errors.email.message}</p>
          )}
        </div>
        <Button type="submit" size="lg" disabled={requestForm.formState.isSubmitting} className="mt-1">
          {requestForm.formState.isSubmitting ? "Sending…" : "Send code"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
