import { useQuery } from "@tanstack/react-query";
import { getSignedUrl, type StorageBucket } from "@/services/storage";

/** Resolves a private-bucket storage path to a short-lived signed URL, cached for its lifetime. */
export function useSignedUrl(bucket: StorageBucket, path: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["signed-url", bucket, path],
    queryFn: () => getSignedUrl(bucket, path as string, 3600),
    enabled: Boolean(path),
    staleTime: 55 * 60 * 1000,
  });
  return data ?? null;
}

export function useSignedAvatarUrl(path: string | null | undefined) {
  return useSignedUrl("avatars", path);
}
