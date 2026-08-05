export function getPersonProfilePath(userId: string, options?: { isSelf?: boolean; preview?: "friend" | "non_friend" }) {
  const base = options?.isSelf ? "/app/profile" : `/app/people/${userId}`;
  if (!options?.preview) return base;
  return `${base}?preview=${options.preview}`;
}
