import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/validation";
import { updatePassword, signOut } from "@/services/auth";
import { useAuth } from "@/hooks/useAuth";
import { useBlockedUsers, useUnblockUser } from "@/hooks/queries/useFriends";
import { useSharedContextProfiles } from "@/hooks/queries/useProfile";
import { useToast } from "@/components/shared/toast";
import { initials } from "@/lib/utils";

export function AccountSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();
  const { data: blocked = [] } = useBlockedUsers();
  const { data: profileMap } = useSharedContextProfiles(blocked);
  const unblock = useUnblockUser();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  async function onChangePassword(values: ResetPasswordValues) {
    try {
      await updatePassword(values.password);
      push("Password updated", "success");
      reset();
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't update your password.", "error");
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="grid gap-5">
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4">
          <p className="text-sm font-medium">Signed in as</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{user?.email}</p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onChangePassword)} className="grid gap-3" noValidate>
        <p className="text-sm font-medium">Change password</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="acc-password">New password</Label>
            <Input id="acc-password" type="password" autoComplete="new-password" {...register("password")} aria-invalid={!!errors.password} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="acc-confirmPassword">Confirm</Label>
            <Input id="acc-confirmPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} aria-invalid={!!errors.confirmPassword} />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
          </div>
        </div>
        <div>
          <Button type="submit" variant="outline" disabled={isSubmitting}>{isSubmitting ? "Updating…" : "Update password"}</Button>
        </div>
      </form>

      {blocked.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Blocked users</p>
          <div className="grid gap-1.5">
            {blocked.map((id) => {
              const p = profileMap?.get(id);
              return (
                <div key={id} className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2">
                  <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{initials(p?.display_name || "?")}</AvatarFallback></Avatar>
                  <span className="flex-1 text-sm">{p?.display_name || "Unknown user"}</span>
                  <Button size="sm" variant="ghost" onClick={() => unblock.mutate(id)}>
                    <ShieldOff className="h-3.5 w-3.5" /> Unblock
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <Button variant="outline" onClick={handleSignOut} className="text-destructive hover:bg-destructive/10">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}
