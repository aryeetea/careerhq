import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { AuthLayout } from "@/pages/auth/AuthLayout";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { signInSchema, type SignInValues } from "@/lib/validation";
import { signIn } from "@/services/auth";
import { useToast } from "@/components/shared/toast";

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);
  // Belt-and-braces guard against a double Enter/click firing two submits
  // before the disabled state on the button has a chance to re-render.
  const submittingRef = React.useRef(false);
  const params = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const redirectTo = params.get("next") ?? (location.state as { from?: string } | null)?.from ?? "/app";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  async function onSubmit(values: SignInValues) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFormError(null);
    try {
      await signIn(values.email, values.password);
      push("Welcome back.", "success");
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't sign in. Check your details and try again.";
      setFormError(message);
      push(message, "error");
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Take a breath. Let's see where things stand.">
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate aria-busy={isSubmitting}>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register("email")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "signin-email-error" : undefined}
          />
          {errors.email && (
            <p id="signin-email-error" className="text-xs font-medium text-destructive">
              {errors.email.message}
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
          <PasswordInput
            id="password"
            autoComplete="current-password"
            {...register("password")}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "signin-password-error" : undefined}
          />
          {errors.password && (
            <p id="signin-password-error" className="text-xs font-medium text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>
        {formError && <AuthNotice variant="error">{formError}</AuthNotice>}
        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1" aria-busy={isSubmitting}>
          {isSubmitting ? (
            <>
              <LoaderCircle className="animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

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
