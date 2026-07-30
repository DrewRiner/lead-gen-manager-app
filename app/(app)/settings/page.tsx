import Link from "next/link";
import { headers } from "next/headers";
import { Users2 } from "lucide-react";
import { asc } from "drizzle-orm";

import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { WebhooksPanel } from "@/components/settings/webhooks-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProfile } from "@/lib/auth";
import { PLATFORM } from "@/lib/config";
import { formatDateInTz } from "@/lib/dates";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { titleCase } from "@/lib/format";
import {
  getPropertyLeadSources,
  getRecentUnmatchedLeads,
  getWebhookEvents,
} from "@/lib/queries/webhooks";
import { getAppSettings } from "@/lib/settings";

export const metadata = { title: "Settings — LeadGen" };
export const dynamic = "force-dynamic";

function timezoneOptions(current: string): string[] {
  let zones: string[] = [];
  const supported = (
    Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
  ).supportedValuesOf;
  if (typeof supported === "function") {
    try {
      zones = supported("timeZone");
    } catch {
      zones = [];
    }
  }
  if (zones.length === 0) {
    zones = [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Phoenix",
      "America/Los_Angeles",
      "America/Anchorage",
      "Pacific/Honolulu",
      "UTC",
    ];
  }
  if (!zones.includes(current)) zones = [current, ...zones];
  return zones;
}

export default async function SettingsPage() {
  const [settings, users, leadSources, unmatchedLeads, events, hdrs, profile] =
    await Promise.all([
      getAppSettings(),
      db.select().from(profiles).orderBy(asc(profiles.email)),
      getPropertyLeadSources(),
      getRecentUnmatchedLeads(20),
      getWebhookEvents(100),
      headers(),
      getProfile(),
    ]);
  const isAdmin = profile?.role === "admin";

  const tz = settings.orgTimezone;

  // Build the public webhook URL from the incoming request's host.
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto =
    hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const webhookUrl = `${proto}://${host}/api/webhooks/ghl-form`;
  const callrailUrl = `${proto}://${host}/api/webhooks/callrail`;
  const twilioUrl = `${proto}://${host}/api/webhooks/twilio`;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Organization configuration and app users."
      />

      {isAdmin ? (
        <Card className="mb-6">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>User management</CardTitle>
              <CardDescription>
                Add, edit, and deactivate the staff who can access this app.
              </CardDescription>
            </div>
            <Link href="/settings/users">
              <Button>
                <Users2 className="mr-2 h-4 w-4" /> Manage users
              </Button>
            </Link>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>
              Timezone, default billing threshold, and spam scoring.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm
              timezones={timezoneOptions(tz)}
              orgTimezone={tz}
              defaultBillableThresholdSeconds={
                settings.defaultBillableThresholdSeconds
              }
              spamScoreThreshold={settings.spamScoreThreshold}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>App users</CardTitle>
            <CardDescription>
              Read-only. Accounts are created by an admin in the Supabase
              dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No users yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.fullName ?? "—"}
                        </TableCell>
                        <TableCell>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                            {titleCase(u.role)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateInTz(u.createdAt, tz)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Webhooks · form & call ingestion</CardTitle>
          <CardDescription>
            Inbound leads. Configure an {PLATFORM.name} workflow to POST form
            submissions, and CallRail to POST calls, to the endpoints below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhooksPanel
            webhookUrl={webhookUrl}
            callrailUrl={callrailUrl}
            twilioUrl={twilioUrl}
            secret={settings.webhookSecret}
            leadSources={leadSources}
            unmatchedLeads={unmatchedLeads}
            events={events}
            tz={tz}
          />
        </CardContent>
      </Card>
    </div>
  );
}
