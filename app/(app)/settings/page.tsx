import { headers } from "next/headers";
import { asc } from "drizzle-orm";

import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { WebhooksPanel } from "@/components/settings/webhooks-panel";
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
  const [settings, users, leadSources, unmatchedLeads, events, hdrs] =
    await Promise.all([
      getAppSettings(),
      db.select().from(profiles).orderBy(asc(profiles.email)),
      getPropertyLeadSources(),
      getRecentUnmatchedLeads(20),
      getWebhookEvents(100),
      headers(),
    ]);

  const tz = settings.orgTimezone;

  // Build the public webhook URL from the incoming request's host.
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto =
    hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const webhookUrl = `${proto}://${host}/api/webhooks/ghl-form`;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Organization configuration and app users."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>
              Timezone, default billing threshold, and producing-health signal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm
              timezones={timezoneOptions(tz)}
              orgTimezone={tz}
              defaultBillableThresholdSeconds={
                settings.defaultBillableThresholdSeconds
              }
              producingMinBillableLeads={settings.producingMinBillableLeads}
              producingMonthsRequired={settings.producingMonthsRequired}
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
          <CardTitle>Webhooks · GoHighLevel form ingestion</CardTitle>
          <CardDescription>
            Inbound form leads. Configure a GHL workflow to POST submissions to
            the endpoint below with the shared secret header.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhooksPanel
            webhookUrl={webhookUrl}
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
