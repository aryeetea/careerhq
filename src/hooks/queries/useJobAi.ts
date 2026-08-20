import { useMutation } from "@tanstack/react-query";
import * as aiService from "@/services/ai";
import type { AnalyzeJobRequest, GenerateCoverLetterRequest, SuggestProfileCopyRequest, TailorResumeRequest } from "@/lib/ai";

export function useAnalyzeJob() {
  return useMutation({
    mutationFn: (request: AnalyzeJobRequest) => aiService.analyzeJob(request),
  });
}

export function useGenerateCoverLetter() {
  return useMutation({
    mutationFn: (request: GenerateCoverLetterRequest) => aiService.generateCoverLetter(request),
  });
}

export function useTailorResume() {
  return useMutation({
    mutationFn: (request: TailorResumeRequest) => aiService.tailorResume(request),
  });
}

export function useSuggestProfileCopy() {
  return useMutation({
    mutationFn: (request: SuggestProfileCopyRequest) => aiService.suggestProfileCopy(request),
  });
}
