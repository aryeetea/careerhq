import { supabase } from "@/lib/supabase";
import type { EncouragementReaction, ReactionContext, ReactionType } from "@/types/database";

export async function sendReaction(input: {
  senderId: string;
  recipientId: string;
  contextType: ReactionContext;
  contextId?: string | null;
  reactionType: ReactionType;
}): Promise<EncouragementReaction> {
  const { data, error } = await supabase
    .from("encouragement_reactions")
    .insert({
      sender_id: input.senderId,
      recipient_id: input.recipientId,
      context_type: input.contextType,
      context_id: input.contextId ?? null,
      reaction_type: input.reactionType,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as EncouragementReaction;
}

export async function listReactionsFor(contextType: ReactionContext, contextId: string): Promise<EncouragementReaction[]> {
  const { data, error } = await supabase
    .from("encouragement_reactions")
    .select("*")
    .eq("context_type", contextType)
    .eq("context_id", contextId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as EncouragementReaction[];
}

export async function listReactionsReceived(userId: string): Promise<EncouragementReaction[]> {
  const { data, error } = await supabase
    .from("encouragement_reactions")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as EncouragementReaction[];
}
