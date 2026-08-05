import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import * as reactionsService from "@/services/reactions";
import type { ReactionContext, ReactionType } from "@/types/database";

export function useReactionsFor(contextType: ReactionContext, contextId: string | null) {
  return useQuery({
    queryKey: queryKeys.reactions(contextType, contextId ?? ""),
    queryFn: () => reactionsService.listReactionsFor(contextType, contextId as string),
    enabled: Boolean(contextId),
  });
}

export function useSendReaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      recipientId: string;
      contextType: ReactionContext;
      contextId?: string | null;
      reactionType: ReactionType;
    }) =>
      reactionsService.sendReaction({
        senderId: user!.id,
        recipientId: input.recipientId,
        contextType: input.contextType,
        contextId: input.contextId,
        reactionType: input.reactionType,
      }),
    onSuccess: (reaction) => {
      if (reaction.context_id) {
        qc.invalidateQueries({ queryKey: queryKeys.reactions(reaction.context_type, reaction.context_id) });
      }
    },
  });
}
