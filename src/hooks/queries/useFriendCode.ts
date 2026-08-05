import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as friendCodeService from "@/services/friendCode";

export function useMyFriendCodes() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: queryKeys.friendCodes(userId),
    queryFn: () => friendCodeService.listMyFriendCodes(),
    enabled: Boolean(userId),
  });
}

function useInvalidateFriendCodes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.friendCodes(user?.id ?? "") });
}

export function useCreateFriendCode() {
  const invalidate = useInvalidateFriendCodes();
  return useMutation({
    mutationFn: () => friendCodeService.createFriendCode(),
    onSuccess: invalidate,
  });
}

export function useRegenerateFriendCode() {
  const invalidate = useInvalidateFriendCodes();
  return useMutation({
    mutationFn: (id: string) => friendCodeService.regenerateFriendCode(id),
    onSuccess: invalidate,
  });
}

export function useValidateFriendCode() {
  return useMutation({
    mutationFn: (code: string) => friendCodeService.validateFriendCode(code),
  });
}

export function useSendFriendRequestByCode() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => friendCodeService.sendFriendRequestByCode(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.outgoingRequests(user?.id ?? "") });
    },
  });
}
