import { TopBar } from "@/components/layout/TopBar";
import { PageContent, PageContainer } from "@/components/layout/PageContent";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { PrivacyForm } from "@/components/settings/PrivacyForm";
import { NotificationsForm } from "@/components/settings/NotificationsForm";
import { JobSearchPreferencesForm } from "@/components/settings/JobSearchPreferencesForm";
import { ThemePicker } from "@/components/settings/ThemePicker";
import { DataPortability } from "@/components/settings/DataPortability";
import { AccountSection } from "@/components/settings/AccountSection";
import { HelpSection } from "@/components/settings/HelpSection";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Settings" subtitle="Make Bloom feel like yours" />
      <PageContent>
        <PageContainer>
          <Card className="glass-subtle border-border/60">
            <CardContent className="p-4 sm:p-6">
              <Tabs defaultValue="profile">
                <TabsList className="flex-wrap">
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="privacy">Privacy</TabsTrigger>
                  <TabsTrigger value="notifications">Notifications</TabsTrigger>
                  <TabsTrigger value="job-search">Job Search</TabsTrigger>
                  <TabsTrigger value="appearance">Appearance</TabsTrigger>
                  <TabsTrigger value="data">Data</TabsTrigger>
                  <TabsTrigger value="account">Account</TabsTrigger>
                  <TabsTrigger value="help">Help</TabsTrigger>
                </TabsList>
                <TabsContent value="profile"><ProfileForm /></TabsContent>
                <TabsContent value="privacy"><PrivacyForm /></TabsContent>
                <TabsContent value="notifications"><NotificationsForm /></TabsContent>
                <TabsContent value="job-search"><JobSearchPreferencesForm /></TabsContent>
                <TabsContent value="appearance"><ThemePicker /></TabsContent>
                <TabsContent value="data"><DataPortability /></TabsContent>
                <TabsContent value="account"><AccountSection /></TabsContent>
                <TabsContent value="help"><HelpSection /></TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </PageContainer>
      </PageContent>
    </div>
  );
}
