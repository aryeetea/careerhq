import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { PrivacyForm } from "@/components/settings/PrivacyForm";
import { NotificationsForm } from "@/components/settings/NotificationsForm";
import { AiResumeForm } from "@/components/settings/AiResumeForm";
import { ThemePicker } from "@/components/settings/ThemePicker";
import { DataPortability } from "@/components/settings/DataPortability";
import { AccountSection } from "@/components/settings/AccountSection";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Settings" subtitle="Make Bloom feel like yours" />
      <div className="flex-1 overflow-y-auto px-4 pb-10 sm:px-8">
        <Card className="glass-subtle border-border/60">
          <CardContent className="p-4 sm:p-6">
            <Tabs defaultValue="profile">
              <TabsList className="flex-wrap">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="privacy">Privacy</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
                <TabsTrigger value="ai-resumes">AI & Resumes</TabsTrigger>
                <TabsTrigger value="appearance">Appearance</TabsTrigger>
                <TabsTrigger value="data">Data</TabsTrigger>
                <TabsTrigger value="account">Account</TabsTrigger>
              </TabsList>
              <TabsContent value="profile"><ProfileForm /></TabsContent>
              <TabsContent value="privacy"><PrivacyForm /></TabsContent>
              <TabsContent value="notifications"><NotificationsForm /></TabsContent>
              <TabsContent value="ai-resumes"><AiResumeForm /></TabsContent>
              <TabsContent value="appearance"><ThemePicker /></TabsContent>
              <TabsContent value="data"><DataPortability /></TabsContent>
              <TabsContent value="account"><AccountSection /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
