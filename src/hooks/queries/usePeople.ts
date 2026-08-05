import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import * as peopleService from "@/services/people";

export function usePeopleProfile(userId: string | undefined, preview?: "friend" | "non_friend") {
  return useQuery({
    queryKey: queryKeys.peopleProfile(userId ?? "", preview),
    queryFn: () => peopleService.getPeopleProfile(userId as string, preview),
    enabled: Boolean(userId),
  });
}
