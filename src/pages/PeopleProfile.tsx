import * as React from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { Ban, Check, Heart, MessageCircleHeart, Sparkles, Target, UserPlus, UserRound, UserRoundMinus, X } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ThoughtBubble } from "@/components/shared/ThoughtBubble";
import { ReactionPicker } from "@/components/friends/ReactionPicker";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { usePeopleProfile } from "@/hooks/queries/usePeople";
import {
  useAcceptFriendRequest,
  useBlockUser,
  useCancelFriendRequest,
  useFriendIds,
  useIncomingRequests,
  useOutgoingRequests,
  useRemoveFriend,
  useSendFriendRequest,
} from "@/hooks/queries/useFriends";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/shared/toast";
import { formatDate, initials } from "@/lib/utils";
import { getPersonProfilePath } from "@/lib/people";
import type { PeopleProfileDenyReason } from "@/types/database";

// Copy for each reason a profile can be unreachable. Kept intentionally
// plain — a viewer should never learn *more* than this (a blocked viewer
// and someone guessing a random id both just see "not available").
const DENY_REASON_COPY: Record<PeopleProfileDenyReason, { title: string; description: string }> = {
  not_found: {
    title: "We couldn't find this profile",
    description: "The link may be out of date, or this account no longer exists.",
  },
  blocked: {
    title: "This profile isn't available",
    description: "It isn't something you can view right now.",
  },
  no_access: {
    title: "This profile isn't available to you",
    description: "You may need to be friends, or they haven't turned on sharing.",
  },
};

export default function PeopleProfile() {
  const { userId = "" } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preview = searchParams.get("preview");
  const previewMode = preview === "friend" || preview === "non_friend" ? preview : undefined;
  const { data: profile, isLoading, isError, refetch } = usePeopleProfile(userId, previewMode);

  if (user?.id === userId && !previewMode) {
    return <Navigate to="/app/profile" replace />;
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Profile" subtitle="Here's what they've chosen to share with you." />
        <div className="px-4 pb-10 sm:px-8">
          <ErrorState description="We couldn't load this profile right now. Try again in a moment." onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Profile" subtitle="Here's what they've chosen to share with you." />
        <div className="grid gap-4 px-4 pb-10 sm:px-8">
          <Skeleton className="h-56 rounded-[2rem]" />
          <Skeleton className="h-44 rounded-[2rem]" />
          <Skeleton className="h-44 rounded-[2rem]" />
        </div>
      </div>
    );
  }

  const denyReason = profile?.deny_reason ?? (profile ? null : "not_found");
  if (denyReason) {
    const copy = DENY_REASON_COPY[denyReason];
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Profile" subtitle="Here's what they've chosen to share with you." />
        <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
          <EmptyState
            icon={<UserRound className="h-5 w-5" />}
            title={copy.title}
            description={copy.description}
            action={
              <Button asChild variant="outline">
                <Link to="/app/friends">Back to Friends</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return <PeopleProfileContent userId={userId} previewMode={previewMode} />;
}

function PeopleProfileContent({ userId, previewMode }: { userId: string; previewMode?: "friend" | "non_friend" }) {
  const { data: profile, refetch } = usePeopleProfile(userId, previewMode);
  const { user } = useAuth();
  const { push } = useToast();
  const avatarUrl = useSignedAvatarUrl(profile?.avatar_url ?? null);
  const sendRequest = useSendFriendRequest();
  const cancelRequest = useCancelFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const removeFriend = useRemoveFriend();
  const blockUser = useBlockUser();
  const { data: incoming = [] } = useIncomingRequests();
  const { data: outgoing = [] } = useOutgoingRequests();
  const { data: friendIds = [] } = useFriendIds();

  const relationship = profile?.relationship ?? "non_friend_preview";
  const outgoingRequest = outgoing.find((request) => request.recipient_id === userId);
  const incomingRequest = incoming.find((request) => request.requester_id === userId);
  const isFriend = friendIds.includes(userId) || relationship === "friend";
  const canEncourage = relationship === "friend" || relationship === "friend_preview" || (relationship === "group_member" && profile?.mutual_groups[0]);
  const reactionContextType = relationship === "group_member" && profile?.mutual_groups[0] ? "group" : "general";
  const reactionContextId = relationship === "group_member" ? profile?.mutual_groups[0]?.id ?? null : null;

  const sharedProgressVisible =
    profile?.applications_this_week !== null ||
    profile?.applications_this_month !== null ||
    profile?.interviews_count !== null ||
    profile?.offers_count !== null ||
    profile?.current_streak !== null;

  const achievementChips = [
    profile?.current_streak ? `${profile.current_streak}-day streak` : null,
    profile?.interviews_count ? `${profile.interviews_count} interviews` : null,
    profile?.offers_count ? `${profile.offers_count} offers` : null,
  ].filter((value): value is string => Boolean(value));

  // Beyond the always-shown identity card and today's-thought card, is
  // there anything else here? If not, say so plainly instead of leaving a
  // long stretch of empty space.
  const hasSharedMuch = Boolean(
    profile?.bio ||
      profile?.career_status ||
      sharedProgressVisible ||
      achievementChips.length > 0 ||
      profile?.shared_goals.length ||
      profile?.certification_name ||
      profile?.mutual_groups.length ||
      profile?.mutual_goals.length
  );

  async function handleSendRequest() {
    await sendRequest.mutateAsync(userId);
    push("Friend request sent", "success");
    void refetch();
  }

  async function handleCancelRequest() {
    if (!outgoingRequest) return;
    await cancelRequest.mutateAsync(outgoingRequest.id);
    push("Friend request cancelled", "info");
    void refetch();
  }

  async function handleAcceptRequest() {
    if (!incomingRequest) return;
    await acceptRequest.mutateAsync(incomingRequest.id);
    push("Friend request accepted", "success");
    void refetch();
  }

  async function handleRemoveFriend() {
    await removeFriend.mutateAsync(userId);
    push("Friend removed", "info");
    void refetch();
  }

  async function handleBlockUser() {
    await blockUser.mutateAsync(userId);
    push("User blocked", "info");
  }

  const primaryAction = (() => {
    if (previewMode) {
      return (
        <Button asChild variant="outline" size="sm">
          <Link to="/app/profile">Back to your profile</Link>
        </Button>
      );
    }
    if (relationship === "incoming_request") {
      return (
        <Button size="sm" className="gap-1.5" onClick={() => void handleAcceptRequest()}>
          <Check className="h-4 w-4" /> Accept friend request
        </Button>
      );
    }
    if (relationship === "outgoing_request") {
      return (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void handleCancelRequest()}>
          <X className="h-4 w-4" /> Cancel request
        </Button>
      );
    }
    if (isFriend && canEncourage) {
      return (
        <ReactionPicker recipientId={userId} contextType={reactionContextType} contextId={reactionContextId} />
      );
    }
    if (!isFriend) {
      return (
        <Button size="sm" className="gap-1.5" onClick={() => void handleSendRequest()}>
          <UserPlus className="h-4 w-4" /> Add friend
        </Button>
      );
    }
    return null;
  })();

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title={previewMode ? `Preview as ${previewMode === "friend" ? "friend" : "non-friend"}` : "Profile"}
        subtitle={
          previewMode
            ? "This is the read-only view someone else would get."
            : "Here's what they've chosen to share with you."
        }
        action={
          <div className="flex items-center gap-2">
            {primaryAction}
            {!previewMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">More</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isFriend && (
                    <DropdownMenuItem onSelect={() => void handleRemoveFriend()}>
                      <UserRoundMinus className="mr-2 h-4 w-4" /> Remove friend
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => void handleBlockUser()} className="text-destructive focus:text-destructive">
                    <Ban className="mr-2 h-4 w-4" /> Block
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
        <div className="grid gap-4">
          <Card className="glass-subtle overflow-hidden border-border/60">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <Avatar className="h-24 w-24 border border-border/80 shadow-soft">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                  <AvatarFallback className="text-xl">{initials(profile?.display_name || profile?.username || "B")}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-3xl font-semibold">{profile?.display_name}</h2>
                      <p className="truncate text-sm text-foreground/68">@{profile?.username}</p>
                    </div>
                    <Chip variant={previewMode ? "warning" : isFriend ? "primary" : "muted"}>
                      {previewMode
                        ? previewMode === "friend"
                          ? "Friend preview"
                          : "Non-friend preview"
                        : relationshipLabel(relationship)}
                    </Chip>
                  </div>

                  {profile?.bio && (
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-foreground/82">{profile.bio}</p>
                  )}

                  {profile?.career_status && (
                    <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary">
                      <Target className="h-4 w-4 shrink-0" /> {profile.career_status}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile?.mutual_groups.length ? <Chip variant="interactive">{profile.mutual_groups.length} mutual group{profile.mutual_groups.length === 1 ? "" : "s"}</Chip> : null}
                    {profile?.mutual_goals.length ? <Chip variant="interactive">{profile.mutual_goals.length} mutual goal{profile.mutual_goals.length === 1 ? "" : "s"}</Chip> : null}
                    {sharedProgressVisible ? <Chip variant="success">Shared progress enabled</Chip> : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {(isFriend || previewMode === "friend") && !hasSharedMuch && (
            <p className="px-1 text-sm text-muted-foreground">They haven&apos;t shared much yet.</p>
          )}

          {(isFriend || previewMode === "friend") && (
            <SectionCard title="Today's Thought" icon={<MessageCircleHeart className="h-4 w-4 text-primary" />}>
              <ThoughtBubble className="max-w-2xl bg-card/80 px-4 py-3">
                <p className="text-sm leading-7 text-foreground/82">
                  {profile?.status_message || <span className="text-muted-foreground">No thought shared today.</span>}
                </p>
              </ThoughtBubble>
            </SectionCard>
          )}

          {sharedProgressVisible && (
            <SectionCard title="Shared Progress" icon={<Sparkles className="h-4 w-4 text-gold" />}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Applications this week" value={numberOrDash(profile?.applications_this_week)} detail={profile?.weekly_goal ? `Goal: ${profile.weekly_goal}` : null}>
                  {profile?.applications_this_week !== null && profile?.weekly_goal ? (
                    <Progress value={Math.min(100, (profile.applications_this_week / Math.max(profile.weekly_goal, 1)) * 100)} className="mt-3 h-1.5" />
                  ) : null}
                </MetricCard>
                <MetricCard label="Applications this month" value={numberOrDash(profile?.applications_this_month)} />
                <MetricCard label="Interviews" value={numberOrDash(profile?.interviews_count)} />
                <MetricCard label="Offers" value={numberOrDash(profile?.offers_count)} />
              </div>
            </SectionCard>
          )}

          {achievementChips.length > 0 && (
            <SectionCard title="Achievements" icon={<Heart className="h-4 w-4 text-rose-400" />}>
              <div className="flex flex-wrap gap-2">
                {achievementChips.map((chip) => (
                  <Chip key={chip} variant="primary">{chip}</Chip>
                ))}
              </div>
            </SectionCard>
          )}

          {profile?.shared_goals.length ? (
            <SectionCard title="Goals" icon={<Target className="h-4 w-4 text-sage" />}>
              <div className="grid gap-3 lg:grid-cols-2">
                {profile.shared_goals.map((goal) => (
                  <div key={goal.id} className="rounded-[1.5rem] border border-border/65 bg-card/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{goal.name}</p>
                        {goal.description ? <p className="mt-1 text-sm leading-6 text-foreground/72">{goal.description}</p> : null}
                      </div>
                      <Chip variant="muted">{goal.target_count} {goal.unit}</Chip>
                    </div>
                    {goal.deadline ? <p className="mt-3 text-xs text-muted-foreground">Target date: {formatDate(goal.deadline)}</p> : null}
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {profile?.certification_name && profile.certification_percentage !== null ? (
            <SectionCard title="Certifications" icon={<Sparkles className="h-4 w-4 text-sky" />}>
              <div className="rounded-[1.5rem] border border-border/65 bg-card/70 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="font-medium">{profile.certification_name}</p>
                  <Chip variant="interactive">{profile.certification_percentage}%</Chip>
                </div>
                <Progress value={profile.certification_percentage} className="mt-3 h-1.5" />
              </div>
            </SectionCard>
          ) : null}

          {(profile?.mutual_groups.length || profile?.mutual_goals.length) ? (
            <SectionCard title="Mutual Connections" icon={<Heart className="h-4 w-4 text-primary" />}>
              <div className="grid gap-4 lg:grid-cols-2">
                {profile?.mutual_groups.length ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mutual groups</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.mutual_groups.map((group) => (
                        <Chip key={group.id} asChild variant="interactive">
                          <Link to={`/app/groups/${group.id}`}>{group.name}</Link>
                        </Chip>
                      ))}
                    </div>
                  </div>
                ) : null}
                {profile?.mutual_goals.length ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mutual goals</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.mutual_goals.map((goal) => (
                        <Chip key={goal.id} variant="neutral">{goal.name}</Chip>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          {user?.id === userId && !previewMode && (
            <SectionCard title="Privacy Preview" icon={<UserRound className="h-4 w-4 text-primary" />}>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to={getPersonProfilePath(userId, { preview: "friend" })}>Preview as friend</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={getPersonProfilePath(userId, { preview: "non_friend" })}>Preview as non-friend</Link>
                </Button>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="glass-subtle border-border/60">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          {icon}
          <h3 className="font-semibold">{title}</h3>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  detail,
  children,
}: {
  label: string;
  value: string;
  detail?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-border/65 bg-card/70 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      {children}
    </div>
  );
}

function relationshipLabel(value: string) {
  switch (value) {
    case "friend":
      return "Friends";
    case "incoming_request":
      return "Sent you a request";
    case "outgoing_request":
      return "Request pending";
    case "group_member":
      return "Same group";
    case "friend_preview":
      return "Friend preview";
    case "non_friend_preview":
      return "Non-friend preview";
    default:
      return "Profile";
  }
}

function numberOrDash(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : String(value);
}
