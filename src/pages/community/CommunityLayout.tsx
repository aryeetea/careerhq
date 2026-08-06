import { Outlet, useLocation } from "react-router-dom";
import { Users2, UsersRound, Inbox } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { CommunityTabs } from "@/components/community/CommunityTabs";
import { useIncomingRequests } from "@/hooks/queries/useFriends";
import { useGroupInvites } from "@/hooks/queries/useGroups";

// The shell for all of Bloom's social features. People think of "who I'm
// connected to on Bloom" as one thing, not three unrelated pages, so
// Friends / Groups / Invites live here as tabs under one layout instead of
// three separate sidebar destinations — this component (header + tab bar)
// stays mounted while the tabs swap underneath it, so moving between them
// never triggers a full page reload.
export default function CommunityLayout() {
  const location = useLocation();
  const { data: incomingFriends = [] } = useIncomingRequests();
  const { data: incomingGroups = [] } = useGroupInvites();
  const invitesWaiting = incomingFriends.length + incomingGroups.length;

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Community" subtitle="Your people, your groups, and what's waiting on you" />
      <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
        <div className="sticky top-0 z-20 -mx-4 bg-background/80 px-4 pb-3 pt-4 backdrop-blur sm:-mx-8 sm:px-8">
          <CommunityTabs
            items={[
              { to: "/app/community/friends", label: "Friends", icon: Users2 },
              { to: "/app/community/groups", label: "Groups", icon: UsersRound },
              { to: "/app/community/invites", label: "Invites", icon: Inbox, count: invitesWaiting },
            ]}
          />
        </div>
        <div key={location.pathname} className="animate-fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
