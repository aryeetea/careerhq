import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Requirement {
  label: string;
  test: (password: string) => boolean;
}

// Guidance only — not enforced. The actual floor (8 characters) lives in
// passwordSchema in lib/validation.ts; this just nudges toward a stronger
// password without blocking anything the schema already allows.
const requirements: Requirement[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "A letter and a number", test: (p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p) },
];

export function PasswordStrengthHint({ password }: { password: string }) {
  if (!password) return null;

  return (
    <ul className="mt-1 grid gap-1 text-xs">
      {requirements.map((req) => {
        const met = req.test(password);
        return (
          <li key={req.label} className={cn("flex items-center gap-1.5", met ? "text-success" : "text-foreground/55")}>
            {met ? <Check className="h-3 w-3 shrink-0" aria-hidden="true" /> : <X className="h-3 w-3 shrink-0 text-foreground/30" aria-hidden="true" />}
            {req.label}
          </li>
        );
      })}
    </ul>
  );
}
