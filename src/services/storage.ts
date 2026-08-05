import { supabase } from "@/lib/supabase";

export type StorageBucket = "resumes" | "certificates" | "avatars";

function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot) : "";
}

/** Uploads under `<bucket>/<userId>/<uuid><ext>` so storage RLS (folder == auth.uid()) applies. */
export async function uploadFile(bucket: StorageBucket, userId: string, file: File): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}${extOf(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function replaceFile(bucket: StorageBucket, userId: string, oldPath: string | null, file: File): Promise<string> {
  const newPath = await uploadFile(bucket, userId, file);
  if (oldPath) {
    await supabase.storage.from(bucket).remove([oldPath]).catch(() => void 0);
  }
  return newPath;
}

export async function deleteFile(bucket: StorageBucket, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

/** Private buckets require a short-lived signed URL for viewing/downloading. */
export async function getSignedUrl(bucket: StorageBucket, path: string, expiresInSeconds = 300): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
