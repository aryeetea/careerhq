import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout } from "@/pages/auth/AuthLayout";
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

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();
  const [otpEmail, setOtpEmail] = React.useState<string | null>(null);
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/app";
  const passwordForm = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });
  const otpRequestForm = useForm<OtpRequestValues>({ resolver: zodResolver(otpRequestSchema) });
  const otpVerifyForm = useForm<OtpVerificationValues>({ resolver: zodResolver(otpVerificationSchema) });

  async function onPasswordSubmit(values: SignInValues) {
    try {
      await signIn(values.email, values.password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't sign in. Check your details and try again.", "error");
    }
  }

  async function sendCode(values: OtpRequestValues) {
    try {
      await requestSignInOtp(values.email);
      setOtpEmail(values.email);
      otpVerifyForm.reset();
      push("Your 6-digit sign-in code is on the way.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't send a sign-in code right now.", "error");
    }
  }

  async function verifyCode(values: OtpVerificationValues) {
    if (!otpEmail) return;

    try {
      await verifyEmailOtp(otpEmail, values.token);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      push(err instanceof Error ? err.message : "That code didn't work. Request a fresh one and try again.", "error");
    }
  }

  async function resendCode() {
    if (!otpEmail) return;

    try {
      await requestSignInOtp(otpEmail);
      otpVerifyForm.reset();
      push("A fresh 6-digit code is on the way.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't resend the code right now.", "error");
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Take a breath. Let's see where things stand.">
      <Tabs defaultValue="password">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="otp">Email code</TabsTrigger>
        </TabsList>

        <TabsContent value="password">
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="grid gap-4" noValidate>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...passwordForm.register("password")}
                aria-invalid={!!passwordForm.formState.errors.password}
              />
              {passwordForm.formState.errors.password && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.password.message}</p>
              )}
            </div>
            <Button type="submit" size="lg" disabled={passwordForm.formState.isSubmitting} className="mt-1">
              {passwordForm.formState.isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="otp">
          {otpEmail ? (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
                Enter the 6-digit code we sent to <span className="font-medium text-foreground">{otpEmail}</span>.
              </div>

              <form onSubmit={otpVerifyForm.handleSubmit(verifyCode)} className="grid gap-4" noValidate>
                <div className="grid gap-1.5">
                  <Label htmlFor="otp">6-digit code</Label>
                  <Input
                    id="otp"
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
                  {otpVerifyForm.formState.isSubmitting ? "Checking code…" : "Continue"}
                </Button>
              </form>

              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={resendCode} className="text-left font-medium text-primary hover:underline">
                  Send a new code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpEmail(null);
                    otpRequestForm.reset();
                    otpVerifyForm.reset();
                  }}
                  className="text-left text-muted-foreground hover:text-foreground"
                >
                  Use another email
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={otpRequestForm.handleSubmit(sendCode)} className="grid gap-4" noValidate>
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
              <p className="text-sm text-muted-foreground">We'll send a 6-digit sign-in code to your email.</p>
              <Button type="submit" size="lg" disabled={otpRequestForm.formState.isSubmitting} className="mt-1">
                {otpRequestForm.formState.isSubmitting ? "Sending code…" : "Email me a code"}
              </Button>
            </form>
          )}
        </TabsContent>
      </Tabs>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        New to Bloom?{" "}
        <Link to="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
