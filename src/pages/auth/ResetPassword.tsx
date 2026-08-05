import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout } from "@/pages/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/validation";
import { updatePassword } from "@/services/auth";
import { useToast } from "@/components/shared/toast";

// Reached via the emailRedirectTo link from requestPasswordReset(). Supabase
// puts a recovery session in the URL hash automatically; onAuthStateChange in
// AuthProvider picks it up, so by the time this form submits, updateUser()
// has a valid session to act on.
export default function ResetPassword() {
  const navigate = useNavigate();
  const { push } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordValues) {
    try {
      await updatePassword(values.password);
      push("Password updated. Welcome back.", "success");
      navigate("/app", { replace: true });
    } catch (err) {
      push(err instanceof Error ? err.message : "That link may have expired. Request a new one.", "error");
    }
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Make it something you'll remember.">
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} aria-invalid={!!errors.password} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} aria-invalid={!!errors.confirmPassword} />
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1">
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
