import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import * as profilesService from "@/services/profiles";
import { logActivity } from "@/services/activity";
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

// Mounted once in RealtimeSync (see AppShell) so a profile field edited in
// another tab or on another device — "Today's thought" chief among them,
// since it's meant to be jotted down quickly and often — shows up here
// without a manual reload. Every other realtime-backed domain (jobs,
// journal, friends, groups, goals) already had this; profiles was the one
// gap. Filtered to this user's own row (`id`, profiles' primary key, not
// `user_id`) — profiles are readable cross-user for the friends/community
// features, and an unfiltered subscription would otherwise fire for every
// other visible profile too.
export function useProfileRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? "";

  useRealtimeTable<Profile>({
    channel: `profile:${userId}`,
    table: "profiles",
    filter: userId ? `id=eq.${userId}` : undefined,
    enabled: Boolean(userId),
    onChange: (payload) => {
      if (payload.eventType === "UPDATE") {
        qc.setQueryData<Profile>(queryKeys.profile(userId), payload.new as Profile);
      }
    },
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
    onSuccess: (updated) => {
      qc.setQueryData<Profile>(queryKeys.profile(user!.id), updated);
      void logActivity(user!.id, "onboarding_completed", "Completed onboarding");
    },
  });
}

export function useCompleteTour() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => profilesService.completeTour(user!.id),
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

// Mounted once in RealtimeSync — theme, hidden board columns, default
// resume, and notification prefs changed on another device reach this
// session immediately, the same way profiles/jobs/goals already do. Without
// this, a setting flipped on one device would sit stale here until
// something else happened to refetch it — and an unrelated settings save
// from this device could then silently overwrite the other device's change.
// `settings.user_id` is the table's primary key, so there's exactly one row.
export function useSettingsRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? "";

  useRealtimeTable<Settings>({
    channel: `settings:${userId}`,
    table: "settings",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: Boolean(userId),
    onChange: (payload) => {
      if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
        qc.setQueryData<Settings>(queryKeys.settings(userId), payload.new as Settings);
      }
    },
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

export function useVisibleBasicProfiles(userIds: string[]) {
  const sorted = [...userIds].sort();
  return useQuery({
    queryKey: ["visible-basic-profiles", sorted],
    queryFn: () => profilesService.getVisibleBasicProfiles(sorted),
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
