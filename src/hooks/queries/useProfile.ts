import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as profilesService from "@/services/profiles";
import type { PrivacySettings, Profile, Settings } from "@/types/database";

export function useProfile() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => profilesService.getProfile(userId),
    enabled: Boolean(userId),
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Profile>) => profilesService.updateProfile(user!.id, patch),
    onSuccess: (updated) => qc.setQueryData<Profile>(queryKeys.profile(user!.id), updated),
  });
}

export function useCompleteOnboarding() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Profile>) => profilesService.completeOnboarding(user!.id, patch),
    onSuccess: (updated) => qc.setQueryData<Profile>(queryKeys.profile(user!.id), updated),
  });
}

export function useUpdateAvatar() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ oldPath, file }: { oldPath: string | null; file: File }) =>
      profilesService.updateAvatar(user!.id, oldPath, file),
    onSuccess: ({ profile }) => qc.setQueryData<Profile>(queryKeys.profile(user!.id), profile),
  });
}

export function useSettings() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.settings(userId),
    queryFn: () => profilesService.getSettings(userId),
    enabled: Boolean(userId),
  });
}

export function useUpdateSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => profilesService.updateSettings(user!.id, patch),
    onSuccess: (updated) => qc.setQueryData<Settings>(queryKeys.settings(user!.id), updated),
  });
}

export function usePrivacySettings() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.privacySettings(userId),
    queryFn: () => profilesService.getPrivacySettings(userId),
    enabled: Boolean(userId),
  });
}

export function useUpdatePrivacySettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<PrivacySettings>) => profilesService.updatePrivacySettings(user!.id, patch),
    onSuccess: (updated) => qc.setQueryData<PrivacySettings>(queryKeys.privacySettings(user!.id), updated),
  });
}

export function useSelectedFriends() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.selectedFriends(userId),
    queryFn: () => profilesService.listSelectedFriends(userId),
    enabled: Boolean(userId),
  });
}

export function useSharedContextProfiles(userIds: string[]) {
  const sorted = [...userIds].sort();
  return useQuery({
    queryKey: ["shared-context-profiles", sorted],
    queryFn: () => profilesService.getSharedContextProfiles(sorted),
    enabled: sorted.length > 0,
    select: (rows) => new Map(rows.map((r) => [r.id, r])),
  });
}

export function useSetSelectedFriends() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendIds: string[]) => profilesService.setSelectedFriends(user!.id, friendIds),
    onSuccess: (_void, friendIds) => qc.setQueryData(queryKeys.selectedFriends(user!.id), friendIds),
  });
}
