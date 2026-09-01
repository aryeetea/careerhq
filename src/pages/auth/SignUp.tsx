import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { AuthLayout } from "@/pages/auth/AuthLayout";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { PasswordStrengthHint } from "@/components/auth/PasswordStrengthHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { signUpSchema, type SignUpValues } from "@/lib/validation";
import { signUp } from "@/services/auth";
import { useToast } from "@/components/shared/toast";

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();
  const params = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const redirectTo = params.get("next") ?? "/app";
  const [formError, setFormError] = React.useState<string | null>(null);
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

    try {
      await signUp(values.email, values.password, values.displayName, redirectTo);
      push("Account created.", "success");
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't create your account. Try again.";
      setFormError(message);
      push(message, "error");
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <AuthLayout title="Start your search, gently" subtitle="A calm home base for everything job-search related.">
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate aria-busy={isSubmitting}>
        <div className="grid gap-1.5">
          <Label htmlFor="displayName">What should we call you? *</Label>
          <Input
            id="displayName"
            autoComplete="name"
            placeholder="Jane Doe"
            required
            aria-required="true"
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
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            aria-required="true"
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
          <Label htmlFor="password">Password *</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            aria-required="true"
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
          <Label htmlFor="confirmPassword">Confirm password *</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            required
            aria-required="true"
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
