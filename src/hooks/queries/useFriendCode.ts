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
    mutationFn: (settings: friendCodeService.FriendCodeSettings) => friendCodeService.createFriendCode(settings),
    onSuccess: invalidate,
  });
}

export function useRegenerateFriendCode() {
  const invalidate = useInvalidateFriendCodes();
  return useMutation({
    mutationFn: ({ id, settings }: { id: string; settings: friendCodeService.FriendCodeSettings }) =>
      friendCodeService.regenerateFriendCode(id, settings),
    onSuccess: invalidate,
  });
}

export function useRevokeFriendCode() {
  const invalidate = useInvalidateFriendCodes();
  return useMutation({
    mutationFn: (id: string) => friendCodeService.revokeFriendCode(id),
    onSuccess: invalidate,
  });
}

export function useValidateFriendCode() {
  return useMutation({
    mutationFn: (code: string) => friendCodeService.validateFriendCode(code),
  });
}

export function useSpendFriendCode() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => friendCodeService.useFriendCode(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.outgoingRequests(user?.id ?? "") });
    },
  });
}
