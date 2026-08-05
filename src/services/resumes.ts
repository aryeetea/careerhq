import { supabase } from "@/lib/supabase";
import type { Resume } from "@/types/database";
import { deleteFile, replaceFile, uploadFile } from "@/services/storage";

export async function listResumes(userId: string): Promise<Resume[]> {
  const { data, error } = await supabase.from("resumes").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as Resume[];
}

export interface CreateResumeInput {
  name: string;
  targetRole?: string | null;
  notes?: string | null;
  file?: File | null;
}

export async function createResume(userId: string, input: CreateResumeInput): Promise<Resume> {
  let filePath: string | null = null;
  if (input.file) filePath = await uploadFile("resumes", userId, input.file);

  const { data, error } = await supabase
    .from("resumes")
    .insert({
      user_id: userId,
      name: input.name,
      target_role: input.targetRole ?? null,
      notes: input.notes ?? null,
      file_path: filePath,
      file_name: input.file?.name ?? null,
      file_type: input.file?.type ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Resume;
}

export async function updateResume(id: string, patch: Partial<Pick<Resume, "name" | "target_role" | "notes">>): Promise<Resume> {
  const { data, error } = await supabase.from("resumes").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Resume;
}

export async function replaceResumeFile(userId: string, resume: Resume, file: File): Promise<Resume> {
  const newPath = await replaceFile("resumes", userId, resume.file_path, file);
  const { data, error } = await supabase
    .from("resumes")
    .update({ file_path: newPath, file_name: file.name, file_type: file.type })
    .eq("id", resume.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Resume;
}

export async function deleteResume(resume: Resume): Promise<void> {
  if (resume.file_path) await deleteFile("resumes", resume.file_path).catch(() => void 0);
  const { error } = await supabase.from("resumes").delete().eq("id", resume.id);
  if (error) throw error;
}
