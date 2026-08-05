import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { AuthLayout } from "@/pages/auth/AuthLayout";
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
import { requestSignUpOtp, signUp, verifyEmailOtp } from "@/services/auth";
import { useToast } from "@/components/shared/toast";

interface PendingOtpSignup {
  email: string;
  displayName: string;
}

export default function SignUp() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [sent, setSent] = React.useState<string | null>(null);
  const [otpSignup, setOtpSignup] = React.useState<PendingOtpSignup | null>(null);
  const passwordForm = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });
  const otpRequestForm = useForm<SignUpOtpRequestValues>({ resolver: zodResolver(signUpOtpRequestSchema) });
  const otpVerifyForm = useForm<OtpVerificationValues>({ resolver: zodResolver(otpVerificationSchema) });

  async function onPasswordSubmit(values: SignUpValues) {
    try {
      const result = await signUp(values.email, values.password, values.displayName);
      if (result.session) {
        navigate("/onboarding", { replace: true });
        return;
      }
      setSent(values.email);
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't create your account. Try again.", "error");
    }
  }

  async function sendCode(values: SignUpOtpRequestValues) {
    try {
      await requestSignUpOtp(values.email, values.displayName);
      setOtpSignup(values);
      otpVerifyForm.reset();
      push("Your 6-digit sign-up code is on the way.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't send a sign-up code right now.", "error");
    }
  }

  async function verifyCode(values: OtpVerificationValues) {
    if (!otpSignup) return;

    try {
      await verifyEmailOtp(otpSignup.email, values.token);
      navigate("/onboarding", { replace: true });
    } catch (err) {
      push(err instanceof Error ? err.message : "That code didn't work. Request a fresh one and try again.", "error");
    }
  }

  async function resendCode() {
    if (!otpSignup) return;

    try {
      await requestSignUpOtp(otpSignup.email, otpSignup.displayName);
      otpVerifyForm.reset();
      push("A fresh 6-digit code is on the way.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't resend the code right now.", "error");
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle="One more step before you're in.">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <span className="font-medium text-foreground">{sent}</span>. Open it to verify your
            email, then come back and sign in.
          </p>
          <Button asChild variant="outline" className="mt-2">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Start your search, gently" subtitle="A calm home base for everything job-search related.">
      <Tabs defaultValue="password">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="otp">Email code</TabsTrigger>
        </TabsList>

        <TabsContent value="password">
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="grid gap-4" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="displayName">What should we call you?</Label>
              <Input
                id="displayName"
                autoComplete="name"
                placeholder="Aileen"
                {...passwordForm.register("displayName")}
                aria-invalid={!!passwordForm.formState.errors.displayName}
              />
              {passwordForm.formState.errors.displayName && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.displayName.message}</p>
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
              />
              {passwordForm.formState.errors.email && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.email.message}</p>
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
              />
              {passwordForm.formState.errors.password && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.password.message}</p>
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
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" size="lg" disabled={passwordForm.formState.isSubmitting} className="mt-1">
              {passwordForm.formState.isSubmitting ? "Creating your space…" : "Create account"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="otp">
          {otpSignup ? (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
                Enter the 6-digit code we sent to <span className="font-medium text-foreground">{otpSignup.email}</span>.
              </div>

              <form onSubmit={otpVerifyForm.handleSubmit(verifyCode)} className="grid gap-4" noValidate>
                <div className="grid gap-1.5">
                  <Label htmlFor="signup-otp">6-digit code</Label>
                  <Input
                    id="signup-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={6}
                    {...otpVerifyForm.register("token")}
                    aria-invalid={!!otpVerifyForm.formState.errors.token}
                  />
                  {otpVerifyForm.formState.errors.token && (
                    <p className="text-xs text-destructive">{otpVerifyForm.formState.errors.token.message}</p>
                  )}
                </div>
                <Button type="submit" size="lg" disabled={otpVerifyForm.formState.isSubmitting} className="mt-1">
                  {otpVerifyForm.formState.isSubmitting ? "Checking code…" : "Create account"}
                </Button>
              </form>

              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={resendCode} className="text-left font-medium text-primary hover:underline">
                  Send a new code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSignup(null);
                    otpRequestForm.reset();
                    otpVerifyForm.reset();
                  }}
                  className="text-left text-muted-foreground hover:text-foreground"
                >
                  Edit email
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={otpRequestForm.handleSubmit(sendCode)} className="grid gap-4" noValidate>
              <div className="grid gap-1.5">
                <Label htmlFor="otp-display-name">What should we call you?</Label>
                <Input
                  id="otp-display-name"
                  autoComplete="name"
                  placeholder="Aileen"
                  {...otpRequestForm.register("displayName")}
                  aria-invalid={!!otpRequestForm.formState.errors.displayName}
                />
                {otpRequestForm.formState.errors.displayName && (
                  <p className="text-xs text-destructive">{otpRequestForm.formState.errors.displayName.message}</p>
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
                  aria-invalid={!!otpRequestForm.formState.errors.email}
                />
                {otpRequestForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{otpRequestForm.formState.errors.email.message}</p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">We'll send a 6-digit code so you can create your account without a password.</p>
              <Button type="submit" size="lg" disabled={otpRequestForm.formState.isSubmitting} className="mt-1">
                {otpRequestForm.formState.isSubmitting ? "Sending code…" : "Email me a code"}
              </Button>
            </form>
          )}
        </TabsContent>
      </Tabs>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
