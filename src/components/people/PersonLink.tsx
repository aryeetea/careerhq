import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getPersonProfilePath } from "@/lib/people";

export function PersonLink({
  userId,
  children,
  className,
  ariaLabel,
}: {
  userId: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const { user } = useAuth();

  return (
    <Link
      to={getPersonProfilePath(userId, { isSelf: user?.id === userId })}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}
