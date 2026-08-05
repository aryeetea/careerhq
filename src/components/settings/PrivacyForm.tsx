import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile, useUpdateProfile, usePrivacySettings, useUpdatePrivacySettings, useSelectedFriends, useSetSelectedFriends } from "@/hooks/queries/useProfile";
import { useFriendCards } from "@/hooks/queries/useFriends";
import { useSignedAvatarUrl } from "@/hooks/useSignedAvatarUrl";
import { useToast } from "@/components/shared/toast";
import { VISIBILITY_META } from "@/lib/constants";
import { initials } from "@/lib/utils";
import type { PrivacySettings, VisibilityLevel } from "@/types/database";

const FIELDS: { key: keyof Omit<PrivacySettings, "user_id" | "created_at" | "updated_at">; label: string; help: string }[] = [
  { key: "profile_visibility", label: "Profile visibility", help: "Whether friends can see your card at all" },
  { key: "weekly_count_visibility", label: "Weekly application count", help: "" },
  { key: "monthly_count_visibility", label: "Monthly application count", help: "" },
  { key: "interview_count_visibility", label: "Interview count", help: "" },
  { key: "offer_count_visibility", label: "Offer count", help: "" },
  { key: "goal_progress_visibility", label: "Weekly goal progress", help: "" },
  { key: "certification_visibility", label: "Certification progress", help: "" },
  { key: "streak_visibility", label: "Activity streak", help: "" },
  { key: "status_message_visibility", label: "Status message", help: "" },
];

function FriendAvatarRow({ id, checked, onToggle }: { id: string; checked: boolean; onToggle: (id: string, checked: boolean) => void }) {
  const { data: friends = [] } = useFriendCards();
  const friend = friends.find((f) => f.user_id === id);
  const avatarUrl = useSignedAvatarUrl(friend?.avatar_url ?? null);
  if (!friend) return null;
  return (
    <button
      onClick={() => onToggle(id, !checked)}
      className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${checked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}
    >
      <Avatar className="h-5 w-5">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback className="text-[9px]">{initials(friend.display_name || friend.username)}</AvatarFallback>
      </Avatar>
      {friend.display_name || friend.username}
    </button>
  );
}

export function PrivacyForm() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: privacy } = usePrivacySettings();
  const updatePrivacy = useUpdatePrivacySettings();
  const { data: friends = [] } = useFriendCards();
  const { data: selectedFriends = [] } = useSelectedFriends();
  const setSelectedFriends = useSetSelectedFriends();
  const { push } = useToast();

  const anySelectedFriends = privacy && Object.values(privacy).includes("selected_friends" as VisibilityLevel);

  async function handleFieldChange(key: keyof PrivacySettings, value: VisibilityLevel) {
    try {
      await updatePrivacy.mutateAsync({ [key]: value });
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't save that.", "error");
    }
  }

  async function toggleSelectedFriend(id: string, checked: boolean) {
    const next = checked ? [...selectedFriends, id] : selectedFriends.filter((f) => f !== id);
    await setSelectedFriends.mutateAsync(next);
  }

  if (!profile || !privacy) return null;

  return (
    <div className="grid gap-5">
      <Card className="border-border/60 bg-card/60">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium">Enable social sharing</p>
            <p className="text-xs text-muted-foreground">The master switch — off means nothing below is ever shared, no matter the settings.</p>
          </div>
          <Switch
            checked={profile.sharing_enabled}
            onCheckedChange={async (v) => {
              await updateProfile.mutateAsync({ sharing_enabled: v });
              push(v ? "Sharing enabled" : "Sharing disabled", "info");
            }}
          />
        </CardContent>
      </Card>

      <div className={profile.sharing_enabled ? "grid gap-3" : "grid gap-3 opacity-50"}>
        {FIELDS.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3.5 py-2.5">
            <span className="text-sm">{f.label}</span>
            <Select
              value={privacy[f.key] as string}
              onValueChange={(v) => handleFieldChange(f.key, v as VisibilityLevel)}
              disabled={!profile.sharing_enabled}
            >
              <SelectTrigger className="w-[168px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(VISIBILITY_META) as VisibilityLevel[]).map((level) => (
                  <SelectItem key={level} value={level}>{VISIBILITY_META[level].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {profile.sharing_enabled && anySelectedFriends && (
        <div>
          <p className="mb-2 text-sm font-medium">Selected friends</p>
          <p className="mb-2 text-xs text-muted-foreground">Used wherever you've chosen "Selected friends" above.</p>
          {friends.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add some friends first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {friends.map((f) => (
                <FriendAvatarRow key={f.user_id} id={f.user_id} checked={selectedFriends.includes(f.user_id)} onToggle={toggleSelectedFriend} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
