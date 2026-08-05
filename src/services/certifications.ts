import { supabase } from "@/lib/supabase";
import type { Certification } from "@/types/database";
import { deleteFile, uploadFile } from "@/services/storage";

export async function listCertifications(userId: string): Promise<Certification[]> {
  const { data, error } = await supabase
    .from("certifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Certification[];
}

export type NewCertification = Pick<Certification, "name"> & Partial<Omit<Certification, "id" | "user_id" | "created_at" | "updated_at">>;

export async function createCertification(userId: string, input: NewCertification, file?: File | null): Promise<Certification> {
  let certificate_file_path: string | null = input.certificate_file_path ?? null;
  if (file) certificate_file_path = await uploadFile("certificates", userId, file);

  const { data, error } = await supabase
    .from("certifications")
    .insert({ ...input, certificate_file_path, user_id: userId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Certification;
}

export async function updateCertification(id: string, patch: Partial<Certification>, file?: File | null): Promise<Certification> {
  const { id: _omit, user_id: _omit2, ...safePatch } = patch as Certification;
  let nextPatch = { ...safePatch };
  if (file) {
    const userId = (patch as Certification).user_id;
    if (userId) nextPatch.certificate_file_path = await uploadFile("certificates", userId, file);
  }
  const { data, error } = await supabase.from("certifications").update(nextPatch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Certification;
}

export async function deleteCertification(cert: Certification): Promise<void> {
  if (cert.certificate_file_path) await deleteFile("certificates", cert.certificate_file_path).catch(() => void 0);
  const { error } = await supabase.from("certifications").delete().eq("id", cert.id);
  if (error) throw error;
}
