import * as React from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMyAccount } from "@/services/auth";
import { useToast } from "@/components/shared/toast";

const CONFIRM_PHRASE = "DELETE";

export function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { push } = useToast();
  const [confirmText, setConfirmText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const canConfirm = confirmText.trim() === CONFIRM_PHRASE;

  function handleOpenChange(next: boolean) {
    if (busy) return;
    if (!next) setConfirmText("");
    onOpenChange(next);
  }

  async function handleDelete() {
    if (!canConfirm || busy) return;
    setBusy(true);
    try {
      await deleteMyAccount();
      push("Your account has been deleted.", "info");
      // The session is gone server-side — send the browser to a fully public
      // route rather than relying on client state to notice and redirect.
      window.location.assign("/");
    } catch (err) {
      setBusy(false);
      push(err instanceof Error ? err.message : "Couldn't delete your account right now. Try again.", "error");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes your profile, jobs, resumes, certifications, goals, friendships, and every file you've
            uploaded. Friends and groups you're part of will no longer see you. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="delete-account-confirm">
            Type <span className="font-semibold text-foreground">{CONFIRM_PHRASE}</span> to confirm
          </Label>
          <Input
            id="delete-account-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            autoFocus
            aria-describedby="delete-account-confirm-help"
          />
          <p id="delete-account-confirm-help" className="text-xs text-muted-foreground">
            This is the only way to make sure this isn't an accidental tap.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={!canConfirm || busy}>
            {busy ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                Deleting…
              </>
            ) : (
              "Delete my account"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
