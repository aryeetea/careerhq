import { supabase } from "@/lib/supabase";

export type StorageBucket = "resumes" | "certificates" | "avatars";

const MAX_FILE_SIZE_BYTES: Record<StorageBucket, number> = {
  resumes: 20 * 1024 * 1024,
  certificates: 10 * 1024 * 1024,
  avatars: 2 * 1024 * 1024,
};

const ALLOWED_FILE_TYPES: Record<StorageBucket, readonly string[]> = {
  resumes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/rtf",
  ],
  certificates: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  avatars: ["image/png", "image/jpeg", "image/webp"],
};

const ALLOWED_EXTENSIONS: Record<StorageBucket, readonly string[]> = {
  resumes: [".pdf", ".doc", ".docx", ".txt", ".rtf"],
  certificates: [".pdf", ".png", ".jpg", ".jpeg", ".webp"],
  avatars: [".png", ".jpg", ".jpeg", ".webp"],
};

function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot) : "";
}

function validateUpload(bucket: StorageBucket, file: File): void {
  const maxSize = MAX_FILE_SIZE_BYTES[bucket];
  if (file.size <= 0 || file.size > maxSize) {
    throw new Error(`File is too large for ${bucket}.`);
  }

  const mime = (file.type || "").toLowerCase();
  const ext = extOf(file.name).toLowerCase();
  const allowedByMime = ALLOWED_FILE_TYPES[bucket].includes(mime);
  const allowedByExtension = ALLOWED_EXTENSIONS[bucket].includes(ext);

  if (!allowedByMime && !allowedByExtension) {
    throw new Error(`Unsupported file type for ${bucket}.`);
  }

  if (/[<>]/.test(file.name)) {
    throw new Error("Filename contains invalid characters.");
  }
}

/** Uploads under `<bucket>/<userId>/<uuid><ext>` so storage RLS (folder == auth.uid()) applies. */
export async function uploadFile(bucket: StorageBucket, userId: string, file: File): Promise<string> {
  validateUpload(bucket, file);
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
  validateUpload(bucket, file);
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
