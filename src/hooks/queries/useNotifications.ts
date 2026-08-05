import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as notificationsService from "@/services/notifications";
import { useSettings } from "@/hooks/queries/useProfile";

export function useNotifications() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data: settings } = useSettings();
  const mutedTypes = settings?.muted_notification_types ?? [];
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [...queryKeys.notifications(userId), mutedTypes],
    queryFn: () => notificationsService.listNotifications(userId, mutedTypes),
    enabled: Boolean(userId),
  });

  React.useEffect(() => {
    if (!userId) return;
    const unsubscribe = notificationsService.subscribeToNotifications(userId, () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
      qc.invalidateQueries({ queryKey: queryKeys.unreadCount(userId) });
    });
    return unsubscribe;
  }, [userId, qc]);

  return query;
}

export function useUnreadCount() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data: settings } = useSettings();
  const mutedTypes = settings?.muted_notification_types ?? [];
  return useQuery({
    queryKey: [...queryKeys.unreadCount(userId), mutedTypes],
    queryFn: () => notificationsService.unreadCount(userId, mutedTypes),
    enabled: Boolean(userId),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications(user?.id ?? "") });
      qc.invalidateQueries({ queryKey: queryKeys.unreadCount(user?.id ?? "") });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllRead(user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications(user?.id ?? "") });
      qc.invalidateQueries({ queryKey: queryKeys.unreadCount(user?.id ?? "") });
    },
  });
}
