import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryKeys = {
  jobs: (userId: string) => ["jobs", userId] as const,
  job: (id: string) => ["job", id] as const,
  jobStatusHistory: (jobId: string) => ["job-status-history", jobId] as const,
  allJobStatusHistory: (userId: string) => ["all-job-status-history", userId] as const,
  resumes: (userId: string) => ["resumes", userId] as const,
  certifications: (userId: string) => ["certifications", userId] as const,
  profile: (userId: string) => ["profile", userId] as const,
  settings: (userId: string) => ["settings", userId] as const,
  privacySettings: (userId: string) => ["privacy-settings", userId] as const,
  selectedFriends: (userId: string) => ["selected-friends", userId] as const,
  friendIds: (userId: string) => ["friend-ids", userId] as const,
  friendCards: (userId: string) => ["friend-cards", userId] as const,
  incomingRequests: (userId: string) => ["incoming-requests", userId] as const,
  outgoingRequests: (userId: string) => ["outgoing-requests", userId] as const,
  blockedUsers: (userId: string) => ["blocked-users", userId] as const,
  userSearch: (query: string) => ["user-search", query] as const,
  goals: (userId: string) => ["goals", userId] as const,
  groups: (userId: string) => ["groups", userId] as const,
  group: (id: string) => ["group", id] as const,
  groupInvites: (userId: string) => ["group-invites", userId] as const,
  sentGroupInvites: (userId: string) => ["sent-group-invites", userId] as const,
  notifications: (userId: string) => ["notifications", userId] as const,
  profileActivity: (userId: string) => ["profile-activity", userId] as const,
  unreadCount: (userId: string) => ["unread-count", userId] as const,
  reactions: (contextType: string, contextId: string) => ["reactions", contextType, contextId] as const,
  friendCodes: (userId: string) => ["friend-codes", userId] as const,
  mutualConnections: (friendId: string) => ["mutual-connections", friendId] as const,
  suggestedFriends: (userId: string) => ["suggested-friends", userId] as const,
  peopleProfile: (userId: string, preview?: string) => ["people-profile", userId, preview ?? "live"] as const,
  journalEntries: (userId: string) => ["journal-entries", userId] as const,
  // Keyed by calendar day (local time) as well as user — once the date
  // rolls over, this key changes and react-query treats it as a fresh,
  // uncached query, which is what naturally triggers tomorrow's message
  // instead of yesterday's staying stuck in the cache.
  dailyEncouragement: (userId: string, dayKey: string) => ["daily-encouragement", userId, dayKey] as const,
};
