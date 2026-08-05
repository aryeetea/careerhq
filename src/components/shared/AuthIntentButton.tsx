import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/shared/toast";
import { signOut } from "@/services/auth";

export function AuthIntentButton({
  children,
  destination,
  signedInLabel,
  ...props
}: ButtonProps & {
  children: React.ReactNode;
  destination: "/signup" | "/login";
  signedInLabel?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { push } = useToast();
  const [isWorking, setIsWorking] = React.useState(false);

  async function handleClick() {
    if (isWorking) return;

    setIsWorking(true);
    try {
      if (user) {
        await signOut();
        push(destination === "/signup" ? "Starting a fresh sign-up." : "Signed out. You can log in again now.", "info");
      }
      navigate(destination);
    } catch (error) {
      push(error instanceof Error ? error.message : "Couldn't switch auth flows right now.", "error");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Button {...props} onClick={handleClick} disabled={props.disabled || isWorking} aria-busy={isWorking}>
      {isWorking ? signedInLabel ?? "One moment…" : children}
    </Button>
  );
}
